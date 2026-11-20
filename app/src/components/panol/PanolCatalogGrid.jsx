import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, Square, ShoppingCart, Edit3, Layers, Scale, Lightbulb, Lock, Camera } from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { buildPasteRowHandler, duplicateRecord } from '../../lib/gridRowActions'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import { OFFICIAL_UNITS, SECURITY_FACTORS, formatUnitMeasureShort, normalizeUnitMeasure } from '../../lib/unitMeasureUtils'
import { MATERIAL_CATEGORIES, getMaterialsColumns, getMaterialsPasteFields, getSecurityFactorBadge, MATERIALS_CLONE_FIELDS } from '../../lib/panolConstants'
import { buildMergedRubrosCatalog, saveInlineCatalogFieldService } from '../../lib/panolCatalogService'

export default function PanolCatalogGrid({
  filteredMaterials, materials, rubros = [], searchQuery, activeKpiFilter, filterCategory, filterStockOnly,
  isAdmin, user, criticalMaterialsCount, stockControlledCount, onClearFilters, onOpenEditMaterialModal,
  onOpenStockAdjustModal, onOpenConsumption6MModal, onPreviewImage, showFeedback, fetchData, setMaterials
}) {
  const navigate = useNavigate()
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })
  const mergedRubros = useMemo(() => buildMergedRubrosCatalog(rubros, materials), [rubros, materials])
  const materialsPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()
  const materialsColumns = useMemo(() => getMaterialsColumns(isAdmin), [isAdmin])

  const handleSaveInlineMaterial = async (matId, field, value) => {
    try {
      const updates = await saveInlineCatalogFieldService({ matId, field, value, materials, isAdmin, user })
      setMaterials((prev) => prev.map((m) => (m.id === matId ? { ...m, ...updates } : m)))
      showFeedback('success', 'Catálogo de materiales actualizado con éxito.')
    } catch (err) {
      showFeedback('error', err.message || 'Error actualizando material.')
    }
  }

  const materialsGrid = useSpreadsheetGrid({
    rows: filteredMaterials,
    columns: materialsColumns,
    getRowId: (m) => m.id,
    storageKey: 'aloncar_panol_materials_grid',
    showFeedback: (type, text) => showFeedback(type, text),
    onPasteRow: (args) => materialsPasteRef.current?.(args),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef || colDef.readOnly) return
      const initialVal = colDef.key === 'unit_measure' ? normalizeUnitMeasure(row.unit_measure, row.name) : String(row[colDef.key] ?? '')
      setInlineEdit({ id: row.id, field: colDef.key, value: initialVal })
    }
  })

  useEffect(() => {
    materialsPasteRef.current = buildPasteRowHandler({
      table: 'materials', entityType: 'materials', fields: getMaterialsPasteFields(isAdmin),
      grid: materialsGrid, setList: setMaterials, nameOf: (r) => r.name || r.id, showFeedback, user: user?.email
    })
  })

  const handleDuplicateMaterial = async (mat) => {
    try {
      await duplicateRecord({
        table: 'materials', entityType: 'materials', source: mat, fields: MATERIALS_CLONE_FIELDS,
        overrides: { name: `${mat.name} (Copia)`, current_stock: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        nameOf: (r) => r.name, user: user?.email || 'Administrador'
      })
      showFeedback('success', `Material "${mat.name}" duplicado con stock 0.`)
      fetchData()
    } catch (err) {
      showFeedback('error', 'Error al duplicar material: ' + (err.message || err))
    }
  }

  const commitTextOrNum = (matId, field) => {
    handleSaveInlineMaterial(matId, field, inlineEdit.value)
    setInlineEdit({ id: null, field: null, value: '' })
  }

  const clearEdit = () => setInlineEdit({ id: null, field: null, value: '' })

  return (
    <div ref={materialsGrid.gridContainerRef} tabIndex={0} onKeyDown={materialsGrid.handleKeyDown} className="alon-zone-grid focus:outline-none font-sans">
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px] inline-flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>CATÁLOGO B.D MATERIALES</span>
          </span>
          <span className="text-slate-400 text-[11px]">
            {materialsGrid.activeCellBadge || (isAdmin
              ? 'Doble clic en celdas para editar Material, Rubro, Categoría, Unidad, Peso, Mínimos y % Seguridad'
              : 'Vista Pañolero (Solo Control de Stock): podés ajustar stock (⚖️), subir fotos (📷/✏️) y ver consumo (💡)')}
          </span>
        </div>
        {materialsGrid.selectedRowIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              const selectedList = materials.filter((m) => materialsGrid.selectedRowIds.has(m.id)).map((m) => ({ id: m.id, name: m.name, unit_measure: normalizeUnitMeasure(m.unit_measure, m.name) }))
              navigate(`/compras?nuevo=true&multiMaterials=${encodeURIComponent(JSON.stringify(selectedList))}`)
            }}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <ShoppingCart className="w-3.5 h-3.5 stroke-[3]" />
            <span>🛒 Generar Pedido de Compra en Lote ({materialsGrid.selectedRowIds.size})</span>
          </button>
        )}
      </div>

      <div className="alon-grid-scroll">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead">
            <tr>
              <th className="py-2 px-1 w-9 text-center select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button type="button" onClick={materialsGrid.toggleSelectAll} className="text-slate-400 hover:text-cyan-400 cursor-pointer" title="Seleccionar todos">
                    {materialsGrid.isAllSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                </div>
              </th>
              <th className="py-2 px-1.5">Material / Insumo {isAdmin ? '✎' : ''}</th>
              <th className="py-2 px-1.5">Rubro Técnico {isAdmin ? '✎' : ''}</th>
              <th className="py-2 px-1.5">Categoría {isAdmin ? '✎' : ''}</th>
              <th className="py-2 px-1.5 text-center">Unidad {isAdmin ? '✎' : ''}</th>
              <th className="py-2 px-1.5 text-right">Peso (kg) {isAdmin ? '✎' : ''}</th>
              <th className="py-2 px-1.5 text-right">Stock Actual</th>
              <th className="py-2 px-1.5 text-right">Stock Mín. {isAdmin ? '✎' : '🔒'}</th>
              <th className="py-2 px-1.5 text-center">Lleva Stock {isAdmin ? '✎' : '🔒'}</th>
              <th className="py-2 px-1.5 text-center">% Seg. Naval {isAdmin ? '✎' : '🔒'}</th>
              <th className="py-2 px-1.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredMaterials.map((mat, idx) => {
              const isSelected = materialsGrid.selectedRowIds.has(mat.id)
              const isCritical = (Number(mat.current_stock) || 0) <= (Number(mat.minimum_stock) || 0) && mat.requires_stock_control
              const badge = getSecurityFactorBadge(mat.security_factor)
              const unitShort = formatUnitMeasureShort(mat.unit_measure)

              return (
                <tr key={mat.id} onContextMenu={(e) => openMenu(e, mat, idx, { entityType: 'materials', recordId: mat.id, recordLabel: mat.name }, materialsGrid)} className={`group transition-colors ${isSelected ? 'bg-cyan-950/40 text-cyan-50' : isCritical ? 'bg-rose-950/20' : 'hover:bg-slate-800/40'}`}>
                  <td className="py-1 px-1 text-center w-9 select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button type="button" onClick={() => materialsGrid.toggleSelectRow(mat.id)} className="text-slate-500 hover:text-cyan-400 cursor-pointer" title="Seleccionar material">
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); openMenu(e, mat, idx, { entityType: 'materials', recordId: mat.id, recordLabel: mat.name }, materialsGrid) }} className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 ${isSelected ? 'text-cyan-300 bg-cyan-950/50' : 'text-slate-500'}`} title={`Fila #${idx + 1}`}>
                        {idx + 1}
                      </button>
                    </div>
                  </td>

                  <td onDoubleClick={() => isAdmin && setInlineEdit({ id: mat.id, field: 'name', value: mat.name || '' })} className={`py-1.5 px-1.5 font-bold text-white max-w-[230px] truncate ${isAdmin ? 'cursor-pointer' : ''}`} title={isAdmin ? 'Doble clic para editar nombre' : 'Material del catálogo'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'name' ? (
                      <input type="text" autoFocus value={inlineEdit.value} onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value.toUpperCase() })} onBlur={() => commitTextOrNum(mat.id, 'name')} onKeyDown={(e) => { if (e.key === 'Enter') commitTextOrNum(mat.id, 'name'); if (e.key === 'Escape') clearEdit() }} className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white uppercase focus:outline-none w-full" />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {mat.image_url ? (
                          <img src={mat.image_url} alt="" onClick={(e) => { e.stopPropagation(); onPreviewImage(mat.image_url) }} className="w-5 h-5 rounded object-cover shrink-0 border border-slate-700 cursor-zoom-in" title="Clic para ampliar foto" />
                        ) : (
                          <button type="button" onClick={(e) => { e.stopPropagation(); if (onOpenEditMaterialModal) onOpenEditMaterialModal(mat) }} className="w-5 h-5 rounded bg-slate-900 hover:bg-amber-950/70 border border-slate-700 hover:border-amber-500/60 flex items-center justify-center text-slate-500 hover:text-amber-300 shrink-0 cursor-pointer" title="Sin foto — Clic para cargar imagen">
                            <Camera className="w-3 h-3" />
                          </button>
                        )}
                        <span className="truncate"><HighlightText text={mat.name} query={searchQuery} /></span>
                      </div>
                    )}
                  </td>

                  <td onDoubleClick={() => isAdmin && setInlineEdit({ id: mat.id, field: 'rubro', value: String(mat.rubro || '').toUpperCase() })} className={`py-1.5 px-1.5 text-slate-300 font-semibold ${isAdmin ? 'cursor-pointer' : ''}`} title={isAdmin ? 'Doble clic para cambiar Rubro Técnico' : 'Rubro Técnico (Solo Admin)'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'rubro' ? (
                      <select autoFocus value={inlineEdit.value} onChange={(e) => { handleSaveInlineMaterial(mat.id, 'rubro', e.target.value); clearEdit() }} onBlur={() => clearEdit()} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none max-w-[140px]">
                        {mergedRubros.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                      </select>
                    ) : <span className="truncate block max-w-[130px]">{mat.rubro || '—'}</span>}
                  </td>

                  <td onDoubleClick={() => isAdmin && setInlineEdit({ id: mat.id, field: 'category', value: mat.category || 'MATERIALES' })} className={`py-1.5 px-1.5 ${isAdmin ? 'cursor-pointer' : ''}`} title={isAdmin ? 'Doble clic para cambiar Categoría' : 'Categoría (Solo Admin)'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'category' ? (
                      <select autoFocus value={inlineEdit.value} onChange={(e) => { handleSaveInlineMaterial(mat.id, 'category', e.target.value); clearEdit() }} onBlur={() => clearEdit()} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none">
                        {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">{mat.category}</span>}
                  </td>

                  <td onDoubleClick={() => isAdmin && setInlineEdit({ id: mat.id, field: 'unit_measure', value: normalizeUnitMeasure(mat.unit_measure, mat.name) })} className={`py-1.5 px-1.5 text-center ${isAdmin ? 'cursor-pointer' : ''}`} title={isAdmin ? 'Doble clic para cambiar Unidad (se sincroniza con Compras)' : 'Unidad oficial (Solo Admin)'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'unit_measure' ? (
                      <select autoFocus value={inlineEdit.value} onChange={(e) => { handleSaveInlineMaterial(mat.id, 'unit_measure', e.target.value); clearEdit() }} onBlur={() => clearEdit()} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-cyan-200 font-bold focus:outline-none">
                        {OFFICIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    ) : <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950/70 text-cyan-300 border border-indigo-500/40">{unitShort}</span>}
                  </td>

                  <td onDoubleClick={() => isAdmin && setInlineEdit({ id: mat.id, field: 'weight_kg', value: String(mat.weight_kg || 0) })} className={`py-1.5 px-1.5 text-right font-mono text-slate-300 ${isAdmin ? 'cursor-pointer' : ''}`} title={isAdmin ? 'Doble clic para editar peso' : 'Peso unitario (Solo Admin)'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'weight_kg' ? (
                      <input type="number" autoFocus step="any" min="0" value={inlineEdit.value} onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })} onBlur={() => commitTextOrNum(mat.id, 'weight_kg')} onKeyDown={(e) => { if (e.key === 'Enter') commitTextOrNum(mat.id, 'weight_kg'); if (e.key === 'Escape') clearEdit() }} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs font-mono text-white w-16 text-right" />
                    ) : <span>{Number(mat.weight_kg) > 0 ? `${mat.weight_kg} kg` : '—'}</span>}
                  </td>

                  <td className="py-1.5 px-1.5 text-right font-mono font-bold whitespace-nowrap">
                    <span className={isCritical ? 'text-rose-400' : 'text-emerald-400'}>{mat.current_stock} {unitShort}</span>
                  </td>

                  <td onDoubleClick={() => { if (isAdmin) setInlineEdit({ id: mat.id, field: 'minimum_stock', value: String(mat.minimum_stock || 0) }); else showFeedback('error', 'Solo el Administrador puede modificar el stock mínimo.') }} className={`py-1.5 px-1.5 text-right font-mono text-slate-400 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`} title={isAdmin ? 'Doble clic para editar stock mínimo (Solo Admin)' : '🔒 Solo editable por Administrador'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'minimum_stock' ? (
                      <input type="number" autoFocus min="0" step="any" value={inlineEdit.value} onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })} onBlur={() => commitTextOrNum(mat.id, 'minimum_stock')} onKeyDown={(e) => { if (e.key === 'Enter') commitTextOrNum(mat.id, 'minimum_stock'); if (e.key === 'Escape') clearEdit() }} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs font-mono text-white w-16 text-right" />
                    ) : <span className="inline-flex items-center gap-1"><span>{mat.minimum_stock || 0}</span>{!isAdmin && <Lock className="w-2.5 h-2.5 text-slate-600" />}</span>}
                  </td>

                  <td onDoubleClick={() => { if (isAdmin) handleSaveInlineMaterial(mat.id, 'requires_stock_control', !mat.requires_stock_control); else showFeedback('error', 'Solo el Administrador puede modificar si lleva control de stock.') }} className={`py-1.5 px-1.5 text-center ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`} title={isAdmin ? 'Doble clic para alternar control de stock (Solo Admin)' : '🔒 Solo editable por Administrador'}>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${mat.requires_stock_control ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      <span>{mat.requires_stock_control ? 'SÍ (Físico)' : 'NO (Eventual)'}</span>{!isAdmin && <Lock className="w-2.5 h-2.5 text-slate-500" />}
                    </span>
                  </td>

                  <td onDoubleClick={() => { if (isAdmin) setInlineEdit({ id: mat.id, field: 'security_factor', value: String(mat.security_factor || 1.06) }); else showFeedback('error', 'Solo el Administrador puede modificar el % de seguridad.') }} className={`py-1.5 px-1.5 text-center ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`} title={isAdmin ? 'Doble clic para editar % seguridad naval (Solo Admin)' : '🔒 Solo editable por Administrador'}>
                    {inlineEdit.id === mat.id && inlineEdit.field === 'security_factor' ? (
                      <select autoFocus value={inlineEdit.value} onChange={(e) => { handleSaveInlineMaterial(mat.id, 'security_factor', e.target.value); clearEdit() }} onBlur={() => clearEdit()} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none">
                        {SECURITY_FACTORS.map((sf) => <option key={sf.value} value={sf.value}>{sf.label}</option>)}
                      </select>
                    ) : <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${badge.style}`}><span>{badge.label}</span>{!isAdmin && <Lock className="w-2.5 h-2.5 text-slate-500" />}</span>}
                  </td>

                  <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => navigate(`/compras?nuevo=true&materialId=${mat.id}&materialName=${encodeURIComponent(mat.name)}`)} className="w-7 h-7 rounded-lg bg-cyan-950/90 hover:bg-cyan-500 border border-cyan-500/60 text-cyan-300 hover:text-slate-950 flex items-center justify-center cursor-pointer transition-colors" title="Reponer en Compras"><ShoppingCart className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => onOpenEditMaterialModal?.(mat)} className="w-7 h-7 rounded-lg bg-sky-950/90 hover:bg-sky-500 border border-sky-500/60 text-sky-300 hover:text-slate-950 flex items-center justify-center cursor-pointer transition-colors" title={isAdmin ? 'Editar Material (Rubro, Categoría, Unidad, Foto, Mínimos, % Seg.)' : 'Ver Ficha y Cargar Foto'}><Edit3 className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => onOpenStockAdjustModal(mat)} className="w-7 h-7 rounded-lg bg-emerald-950/90 hover:bg-emerald-500 border border-emerald-500/60 text-emerald-300 hover:text-slate-950 flex items-center justify-center cursor-pointer transition-colors" title="Ajustar Stock Físico"><Scale className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => onOpenConsumption6MModal?.(mat)} className="w-7 h-7 rounded-lg bg-amber-950/90 hover:bg-amber-400 border border-amber-500/70 text-amber-300 hover:text-slate-950 flex items-center justify-center cursor-pointer transition-colors" title="💡 Consumo Inteligente: Últimos 6 meses y OTs únicas"><Lightbulb className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {menuTarget && menuTarget.entityType === 'materials' && (
        <GridContextMenu
          target={menuTarget} onClose={closeMenu} onCopyCell={materialsGrid.copyActiveCell} onCopyRow={materialsGrid.copyRow}
          onPaste={isAdmin ? materialsGrid.pasteToActiveOrRange : undefined} onDeleteCell={isAdmin ? materialsGrid.deleteActiveCellOrRange : undefined}
          onDuplicateRow={isAdmin ? (row) => handleDuplicateMaterial(row) : undefined}
          customActions={[
            { id: 'reponer-material', label: '🛒 Reponer en Compras', icon: ShoppingCart, iconClass: 'text-cyan-400', hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-cyan-300', visible: true, onClick: () => navigate(`/compras?nuevo=true&materialId=${menuTarget.row.id}&materialName=${encodeURIComponent(menuTarget.row.name)}`) },
            { id: 'editar-material', label: isAdmin ? '✏️ Editar Material' : '📷 Ver Ficha / Subir Foto', icon: Edit3, iconClass: 'text-sky-400', hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-sky-300', visible: true, onClick: () => onOpenEditMaterialModal?.(menuTarget.row) },
            { id: 'ajustar-stock', label: '⚖️ Ajustar Stock Físico', icon: Scale, iconClass: 'text-emerald-400', hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-emerald-300', visible: true, onClick: () => onOpenStockAdjustModal(menuTarget.row) },
            { id: 'consumo-6m', label: '💡 Consumo Últimos 6 Meses', icon: Lightbulb, iconClass: 'text-amber-400', hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-amber-300', visible: true, onClick: () => onOpenConsumption6MModal?.(menuTarget.row) }
          ]}
          entityType="materials" recordId={menuTarget.recordId} recordLabel={menuTarget.recordLabel}
        />
      )}

      <GridStatusBarBottom
        filteredCount={filteredMaterials.length} totalCount={materials.length} entityName="materiales"
        hasActiveFilter={Boolean(searchQuery || activeKpiFilter || filterCategory !== 'TODAS' || filterStockOnly)}
        onClearFilters={onClearFilters} selectionStats={materialsGrid.selectionStats}
        onClearSelection={() => materialsGrid.setSelectionRange(null)}
        customSelection={materialsGrid.selectedRowIds.size > 0 ? { count: materialsGrid.selectedRowIds.size, label: 'materiales tildados', onClear: materialsGrid.clearRowSelection } : null}
        globalAggregates={[{ label: 'Total Insumos', value: materials.length, highlight: true }, { label: 'Stock Crítico', value: criticalMaterialsCount }, { label: 'Con Control Físico', value: stockControlledCount }]}
      />
    </div>
  )
}
