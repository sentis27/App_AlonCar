import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  Square,
  Package,
  ShoppingCart,
  Edit3,
  Layers,
  Flame,
  Shield,
  Building2,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Plus,
  RotateCcw,
  Truck
} from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { buildPasteRowHandler, duplicateRecord } from '../../lib/gridRowActions'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import GasTraceabilityGrid from './GasTraceabilityGrid'
import {
  getMaterialsColumns,
  getSecurityFactorBadge,
  MATERIALS_CLONE_FIELDS,
  MATERIALS_PASTE_FIELDS
} from '../../lib/panolConstants'
import { saveInlineMaterialService } from '../../lib/panolService'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function PanolStockPanel({
  activeTab,
  filteredMaterials,
  materials,
  gasStats,
  gasMovements = [],
  setGasMovements = null,
  suppliers = [],
  ships = [],
  workOrders = [],
  searchQuery,
  activeKpiFilter,
  filterCategory,
  filterStockOnly,
  isAdmin,
  user,
  criticalMaterialsCount,
  stockControlledCount,
  onClearFilters,
  onOpenStockAdjustModal,
  onOpenWithdrawalModal,
  onOpenGasFinalReturnModal = null,
  onOpenGasSupplierModal = null,
  onPreviewImage,
  showFeedback,
  fetchData,
  setMaterials
}) {
  const navigate = useNavigate()
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })
  const [traceSupplierFilter, setTraceSupplierFilter] = useState('TODOS')
  const [traceMaterialFilter, setTraceMaterialFilter] = useState('TODOS')

  const handleSaveInlineMaterial = async (matId, field, value) => {
    try {
      if (field === 'security_factor' && !isAdmin) {
        return showFeedback('error', 'Solo el Administrador puede modificar el porcentaje de seguridad.')
      }
      const updates = await saveInlineMaterialService({ matId, field, value, materials, user })
      setMaterials((prev) => prev.map((m) => (m.id === matId ? { ...m, ...updates } : m)))
      showFeedback('success', 'Catálogo de materiales actualizado con éxito.')
    } catch (err) {
      showFeedback('error', 'Error actualizando material: ' + err.message)
    }
  }

  const materialsPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const materialsColumns = useMemo(() => getMaterialsColumns(isAdmin), [isAdmin])

  const materialsGrid = useSpreadsheetGrid({
    rows: filteredMaterials,
    columns: materialsColumns,
    getRowId: (m) => m.id,
    storageKey: 'aloncar_panol_materials_grid',
    showFeedback: (type, text) => showFeedback(type, text),
    onPasteRow: (args) => materialsPasteRef.current?.(args),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef || colDef.readOnly) return
      setInlineEdit({ id: row.id, field: colDef.key, value: String(row[colDef.key] ?? '') })
    }
  })

  useEffect(() => {
    materialsPasteRef.current = buildPasteRowHandler({
      table: 'materials',
      entityType: 'materials',
      fields: MATERIALS_PASTE_FIELDS,
      grid: materialsGrid,
      setList: setMaterials,
      nameOf: (r) => r.name || r.id,
      showFeedback,
      user: user?.email
    })
  })

  const handleDuplicateMaterial = async (mat) => {
    try {
      const actor = user?.email || 'Administrador'
      await duplicateRecord({
        table: 'materials',
        entityType: 'materials',
        source: mat,
        fields: MATERIALS_CLONE_FIELDS,
        overrides: {
          name: `${mat.name} (Copia)`,
          current_stock: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        nameOf: (r) => r.name,
        user: actor
      })
      showFeedback('success', `Material "${mat.name}" duplicado con stock 0.`)
      fetchData()
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al duplicar material: ' + (err.message || err))
    }
  }

  // ==============================================================================
  // RENDER PESTAÑA 2: CONTROL DE GASES
  // ==============================================================================
  if (activeTab === 'gases') {
    return (
      <div className="space-y-4 font-sans">
        {/* Tarjetas de Stock en Patio y Cuenta por Empresa Gasera */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Object.values(gasStats.patioStock).map(
            ({ supplier, full, empty, withContractors = 0, totalCompanyCylinders, byGas = [] }) => {
              const totalPatio = full + empty
              const companyTotal = totalCompanyCylinders ?? (totalPatio + withContractors)
              const isSupFiltered = traceSupplierFilter === supplier.id
              return (
                <div
                  key={supplier.id}
                  className={`p-3.5 rounded-xl bg-slate-900 border shadow-lg flex flex-col justify-between transition-all ${
                    isSupFiltered ? 'border-cyan-400 ring-1 ring-cyan-400/50' : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTraceSupplierFilter(isSupFiltered ? 'TODOS' : supplier.id)
                          setTraceMaterialFilter('TODOS')
                        }}
                        className="font-black text-white hover:text-cyan-300 text-xs truncate text-left cursor-pointer"
                        title="Clic para filtrar la Tabla de Trazabilidad por esta empresa"
                      >
                        {supplier.name}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenGasSupplierModal && (
                          <button
                            type="button"
                            onClick={() => onOpenGasSupplierModal(supplier.id)}
                            className="px-1.5 py-0.5 rounded bg-cyan-950/90 hover:bg-cyan-800 border border-cyan-500/50 text-cyan-200 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                            title={`Cargar Remito o Saldo Inicial con ${supplier.name}`}
                          >
                            <Truck className="w-2.5 h-2.5 text-cyan-300" />
                            <span>± Remito</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40">
                        <span className="block text-[9px] text-emerald-400 font-bold uppercase">Llenos</span>
                        <span className="text-lg font-black text-emerald-300 font-mono">{full}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-rose-950/50 border border-rose-500/40">
                        <span className="block text-[9px] text-rose-400 font-bold uppercase">Vacíos</span>
                        <span className="text-lg font-black text-rose-300 font-mono">{empty}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-500/35">
                        <span className="block text-[9px] text-amber-400 font-bold uppercase">En Obra</span>
                        <span className="text-lg font-black text-amber-300 font-mono">{withContractors}</span>
                      </div>
                    </div>

                    {/* Desglose por Tipo de Gas */}
                    {byGas.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1">
                        <span className="block text-[9px] font-bold uppercase text-slate-400">
                          Desglose por Gas:
                        </span>
                        {byGas.map((g) => {
                          const isGasFiltered =
                            traceSupplierFilter === supplier.id && traceMaterialFilter === g.materialId
                          return (
                            <button
                              key={g.materialId || g.materialName}
                              type="button"
                              onClick={() => {
                                if (isGasFiltered) {
                                  setTraceSupplierFilter('TODOS')
                                  setTraceMaterialFilter('TODOS')
                                } else {
                                  setTraceSupplierFilter(supplier.id)
                                  setTraceMaterialFilter(g.materialId || 'TODOS')
                                }
                              }}
                              className={`w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded text-[10px] border cursor-pointer transition-colors ${
                                isGasFiltered
                                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100'
                                  : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-200'
                              }`}
                              title="Clic para filtrar trazabilidad de este gas"
                            >
                              <span className="font-bold truncate">{g.materialName.replace(/^GAS\s+/i, '').replace(/\s+TUBO$/i, '')}</span>
                              <span className="font-mono text-[10px] shrink-0">
                                <span className="text-emerald-300">{g.full}Ll</span>
                                {' · '}
                                <span className="text-rose-300">{g.empty}Vc</span>
                                {g.withContractors > 0 && (
                                  <span className="text-amber-300"> · {g.withContractors}Ob</span>
                                )}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-0.5 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total en Patio:</span>
                      <span className="font-mono font-bold text-slate-200">{totalPatio} tubos</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-bold">Total Envases Empresa:</span>
                      <span className="font-mono font-black text-cyan-200">{companyTotal} tubos</span>
                    </div>
                  </div>
                </div>
              )
            }
          )}
        </div>

        {/* Matriz de Deuda de Tubos por Contratista */}
        <div className="alon-zone-grid">
          <div className="alon-grid-ribbon">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Matriz de Deuda de Tubos por Contratista / Obra</span>
            </span>
            <span className="text-slate-500 text-[11px]">
              Regla P-01: Alerta ante retención mayor a 15 días sin rotación
            </span>
          </div>

          <div className="alon-grid-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 alon-grid-thead">
                <tr>
                  <th className="py-2.5 px-3">Contratista / Taller</th>
                  <th className="py-2.5 px-3 text-center">Tubos en Poder</th>
                  <th className="py-2.5 px-3">Detalle por Gas / Marca y Recambios</th>
                  <th className="py-2.5 px-3">Estado de Retención</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(gasStats.contractorDebts)
                  .filter(([cName, data]) => {
                    if (!searchQuery.trim()) return true
                    const searchable = [
                      cName,
                      ...(data.activeHoldings || []).map((h) => `${h.materialName} ${h.supplierName}`),
                      ...(data.exchangesByBrand || []).map((ex) => `${ex.materialName} ${ex.deliveredSupplierName} ${ex.returnedSupplierName}`)
                    ].join(' ')
                    return matchesUniversalSearch(searchable, searchQuery)
                  })
                  .map(([cName, data]) => {
                    const longHeld = gasStats.longHeldContractors.find((lh) => lh.contractor === cName)
                    const activeHoldings = data.activeHoldings || []
                    const exchangesByBrand = data.exchangesByBrand || []
                    return (
                      <tr key={cName} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white align-middle">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span><HighlightText text={cName} query={searchQuery} /></span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center align-middle">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs ${
                                data.totalHeld > 0
                                  ? 'bg-amber-950 text-amber-300 border border-amber-600'
                                  : 'bg-slate-800/70 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {data.totalHeld} tubos
                            </span>
                            {data.exchangesCount > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/80 border border-sky-700/60 text-sky-300 font-bold text-[10px]"
                                title="Recambio 1x1 mantiene deuda neta en +0 (trajo vacío y retiró lleno)"
                              >
                                🔄 {data.exchangesCount} recambio{data.exchangesCount === 1 ? '' : 's'} 1x1
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <div className="flex flex-wrap gap-1.5">
                            {activeHoldings.map((h) => (
                              <span
                                key={h.key}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/60 text-amber-200 text-[10px] font-bold"
                              >
                                <span className="font-mono text-amber-300">{h.qty}x</span>
                                <span>{h.materialName}</span>
                                <span className="text-amber-400">· {h.supplierName}</span>
                              </span>
                            ))}
                            {exchangesByBrand.map((ex) => (
                              <span
                                key={ex.key}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/50 border border-sky-700/50 text-sky-200 text-[10px]"
                              >
                                <span className="font-mono font-bold text-sky-300">🔄 {ex.qty}x</span>
                                <span className="font-semibold">{ex.materialName}:</span>
                                <span>Ent. {ex.deliveredSupplierName} / Dev. {ex.returnedSupplierName}</span>
                              </span>
                            ))}
                            {activeHoldings.length === 0 && exchangesByBrand.length === 0 && (
                              <span className="text-slate-500 text-[11px]">Sin movimientos activos</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          {longHeld ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 border border-rose-600 text-rose-300 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>{longHeld.days} días retenidos (&gt;15d)</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Normal</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {data.totalHeld > 0 && onOpenGasFinalReturnModal && (
                              <button
                                type="button"
                                onClick={() => onOpenGasFinalReturnModal(cName)}
                                className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/70 text-amber-200 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer transition-colors"
                                title="Elegir y devolver tubo(s) vacío(s) en poder de este contratista"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-300" />
                                <span>Devolución Final</span>
                              </button>
                            )}
                            {longHeld && (
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = `Hola ${cName}, desde Pañol Alon Car te recordamos que poseen cilindros de gas con más de ${longHeld.days} días de retiro. Por favor coordinar recambio o devolución final para evitar cargos de alquiler. Muchas gracias.`
                                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                                }}
                                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-600 text-rose-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Reclamar WhatsApp</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla Cronológica Completa de Trazabilidad (Gaseras + Contratistas) */}
        <GasTraceabilityGrid
          gasMovements={gasMovements}
          setGasMovements={setGasMovements}
          suppliers={suppliers}
          materials={materials}
          ships={ships}
          workOrders={workOrders}
          searchQuery={searchQuery}
          filterSupplierId={traceSupplierFilter}
          setFilterSupplierId={setTraceSupplierFilter}
          filterMaterialId={traceMaterialFilter}
          setFilterMaterialId={setTraceMaterialFilter}
          isAdmin={isAdmin}
          user={user}
          showFeedback={showFeedback}
          onOpenSupplierModal={onOpenGasSupplierModal}
        />
      </div>
    )
  }

  // ==============================================================================
  // RENDER PESTAÑA 4: CONTROL EPP
  // ==============================================================================
  if (activeTab === 'epp') {
    return (
      <div className="alon-zone-grid p-6 text-center text-slate-400 space-y-3 font-sans">
        <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Registro y Control de Elementos de Protección Personal (EPP)</h2>
        <p className="text-xs max-w-md mx-auto">
          Consolidado histórico de entregas de botines, cascos, antiparras y guantes asignados a cada operario y contratista.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenWithdrawalModal}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Registrar Nueva Entrega de EPP</span>
          </button>
        </div>
      </div>
    )
  }

  // ==============================================================================
  // RENDER PESTAÑA 3: CATÁLOGO B.D MATERIALES & STOCK
  // ==============================================================================
  return (
    <div
      ref={materialsGrid.gridContainerRef}
      tabIndex={0}
      onKeyDown={materialsGrid.handleKeyDown}
      className="alon-zone-grid focus:outline-none font-sans"
    >
      {/* Ribbon Superior de Catálogo */}
      <div className="alon-grid-ribbon">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px] inline-flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>CATÁLOGO B.D MATERIALES</span>
          </span>
          <span className="text-slate-400 text-[11px]">
            {materialsGrid.activeCellBadge || 'Doble clic en celdas para editar Nombre, Peso, Stock Mínimo y Control de Stock'}
          </span>
        </div>

        {materialsGrid.selectedRowIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              const selectedList = materials
                .filter((m) => materialsGrid.selectedRowIds.has(m.id))
                .map((m) => ({ id: m.id, name: m.name, unit_measure: m.unit_measure }))
              navigate(`/compras?nuevo=true&multiMaterials=${encodeURIComponent(JSON.stringify(selectedList))}`)
            }}
            className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg animate-in fade-in"
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
                  <button
                    type="button"
                    onClick={materialsGrid.toggleSelectAll}
                    className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Seleccionar o deseleccionar todos los materiales visibles"
                  >
                    {materialsGrid.isAllSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                </div>
              </th>
              <th className="py-2 px-1.5">Material / Insumo ✎</th>
              <th className="py-2 px-1.5">Rubro Técnico</th>
              <th className="py-2 px-1.5">Categoría</th>
              <th className="py-2 px-1.5 text-right">Peso Unit. (kg) ✎</th>
              <th className="py-2 px-1.5 text-right">Stock Actual</th>
              <th className="py-2 px-1.5 text-right">Stock Mínimo ✎</th>
              <th className="py-2 px-1.5 text-center">Lleva Stock Físico ✎</th>
              <th className="py-2 px-1.5 text-center">% Seg. Naval ✎</th>
              <th className="py-2 px-1.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredMaterials.map((mat, idx) => {
              const isSelected = materialsGrid.selectedRowIds.has(mat.id)
              const curr = Number(mat.current_stock) || 0
              const min = Number(mat.minimum_stock) || 0
              const isCritical = curr <= min && mat.requires_stock_control
              const badge = getSecurityFactorBadge(mat.security_factor)

              return (
                <tr
                  key={mat.id}
                  onContextMenu={(e) => openMenu(e, mat, idx, { entityType: 'materials', recordId: mat.id, recordLabel: mat.name }, materialsGrid)}
                  className={`group transition-colors ${
                    isSelected ? 'bg-cyan-950/40 text-cyan-50' : isCritical ? 'bg-rose-950/20' : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Columna 0 Canónica */}
                  <td className="py-1 px-1 text-center w-9 select-none relative">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => materialsGrid.toggleSelectRow(mat.id)}
                        className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar material"
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openMenu(e, mat, idx, { entityType: 'materials', recordId: mat.id, recordLabel: mat.name }, materialsGrid)
                        }}
                        className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
                          isSelected ? 'text-cyan-300 bg-cyan-950/50 ring-1 ring-cyan-500/40' : 'text-slate-500 group-hover:text-cyan-400'
                        }`}
                        title={`Fila #${idx + 1} • Clic para menú contextual (o clic derecho)`}
                      >
                        {idx + 1}
                      </button>
                    </div>
                  </td>

                  {/* Nombre Material */}
                  <td
                    onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'name', value: mat.name || '' })}
                    className="py-1.5 px-1.5 font-bold text-white cursor-pointer max-w-[240px] truncate"
                    title="Doble clic para editar nombre"
                  >
                    {inlineEdit.id === mat.id && inlineEdit.field === 'name' ? (
                      <input
                        type="text"
                        autoFocus
                        value={inlineEdit.value}
                        onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                        onBlur={() => {
                          handleSaveInlineMaterial(mat.id, 'name', inlineEdit.value)
                          setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveInlineMaterial(mat.id, 'name', inlineEdit.value)
                            setInlineEdit({ id: null, field: null, value: '' })
                          }
                          if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none w-full"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {mat.image_url ? (
                          <img
                            src={mat.image_url}
                            alt=""
                            onClick={(e) => {
                              e.stopPropagation()
                              onPreviewImage(mat.image_url)
                            }}
                            className="w-5 h-5 rounded object-cover shrink-0 border border-slate-700 cursor-zoom-in"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <HighlightText text={mat.name} query={searchQuery} />
                      </div>
                    )}
                  </td>

                  {/* Rubro */}
                  <td className="py-1.5 px-1.5 text-slate-300 font-semibold">{mat.rubro || '—'}</td>

                  {/* Categoría */}
                  <td className="py-1.5 px-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {mat.category}
                    </span>
                  </td>

                  {/* Peso Unitario */}
                  <td
                    onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'weight_kg', value: String(mat.weight_kg || 0) })}
                    className="py-1.5 px-1.5 text-right font-mono text-slate-300 cursor-pointer"
                    title="Doble clic para editar peso por unidad"
                  >
                    {inlineEdit.id === mat.id && inlineEdit.field === 'weight_kg' ? (
                      <input
                        type="number"
                        autoFocus
                        step="any"
                        min="0"
                        value={inlineEdit.value}
                        onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                        onBlur={() => {
                          handleSaveInlineMaterial(mat.id, 'weight_kg', inlineEdit.value)
                          setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveInlineMaterial(mat.id, 'weight_kg', inlineEdit.value)
                            setInlineEdit({ id: null, field: null, value: '' })
                          }
                          if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs font-mono text-white focus:outline-none w-16 text-right"
                      />
                    ) : (
                      <span>{Number(mat.weight_kg) > 0 ? `${mat.weight_kg} kg` : '—'}</span>
                    )}
                  </td>

                  {/* Stock Actual */}
                  <td className="py-1.5 px-1.5 text-right font-mono font-bold">
                    <span className={isCritical ? 'text-rose-400' : 'text-emerald-400'}>
                      {mat.current_stock} {mat.unit_measure || 'un.'}
                    </span>
                  </td>

                  {/* Stock Mínimo */}
                  <td
                    onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'minimum_stock', value: String(mat.minimum_stock || 0) })}
                    className="py-1.5 px-1.5 text-right font-mono text-slate-400 cursor-pointer"
                    title="Doble clic para editar stock mínimo de reposición"
                  >
                    {inlineEdit.id === mat.id && inlineEdit.field === 'minimum_stock' ? (
                      <input
                        type="number"
                        autoFocus
                        min="0"
                        value={inlineEdit.value}
                        onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                        onBlur={() => {
                          handleSaveInlineMaterial(mat.id, 'minimum_stock', inlineEdit.value)
                          setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveInlineMaterial(mat.id, 'minimum_stock', inlineEdit.value)
                            setInlineEdit({ id: null, field: null, value: '' })
                          }
                          if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs font-mono text-white focus:outline-none w-16 text-right"
                      />
                    ) : (
                      <span>{mat.minimum_stock || 0}</span>
                    )}
                  </td>

                  {/* Lleva Control de Stock Físico */}
                  <td
                    onDoubleClick={() => handleSaveInlineMaterial(mat.id, 'requires_stock_control', !mat.requires_stock_control)}
                    className="py-1.5 px-1.5 text-center cursor-pointer"
                    title="Doble clic para alternar si lleva o no control de stock"
                  >
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        mat.requires_stock_control
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {mat.requires_stock_control ? 'SÍ (Físico)' : 'NO (Eventual)'}
                    </span>
                  </td>

                  {/* % Seguridad Naval */}
                  <td
                    onDoubleClick={() => {
                      if (isAdmin) {
                        setInlineEdit({ id: mat.id, field: 'security_factor', value: String(mat.security_factor || 1.06) })
                      } else {
                        showFeedback('error', 'Solo el Administrador puede modificar el porcentaje de seguridad.')
                      }
                    }}
                    className="py-1.5 px-1.5 text-center cursor-pointer"
                    title={isAdmin ? 'Doble clic para editar factor de seguridad (Solo Admin)' : 'Factor de seguridad naval'}
                  >
                    {inlineEdit.id === mat.id && inlineEdit.field === 'security_factor' ? (
                      <select
                        autoFocus
                        value={inlineEdit.value}
                        onChange={(e) => {
                          handleSaveInlineMaterial(mat.id, 'security_factor', e.target.value)
                          setInlineEdit({ id: null, field: null, value: '' })
                        }}
                        onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                        className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none"
                      >
                        <option value="1.02">2% (1.02)</option>
                        <option value="1.06">6% (1.06 Estándar)</option>
                        <option value="1.10">10% (1.10)</option>
                        <option value="1.15">15% (1.15)</option>
                        <option value="1.20">20% (1.20)</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${badge.style}`}>
                        {badge.label}
                      </span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/compras?nuevo=true&materialId=${mat.id}&materialName=${encodeURIComponent(mat.name)}`)
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Generar pedido de reposición en Compras"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Reponer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenStockAdjustModal(mat)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Ajustar inventario físico"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MENÚ CONTEXTUAL CANÓNICO (clic derecho) - Catálogo */}
      {menuTarget && menuTarget.entityType === 'materials' && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={materialsGrid.copyActiveCell}
          onCopyRow={materialsGrid.copyRow}
          onPaste={materialsGrid.pasteToActiveOrRange}
          onDeleteCell={materialsGrid.deleteActiveCellOrRange}
          onDuplicateRow={(row) => handleDuplicateMaterial(row)}
          customActions={[
            {
              id: 'reponer-material',
              label: '🛒 Reponer en Compras',
              icon: ShoppingCart,
              iconClass: 'text-cyan-400',
              hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-cyan-300',
              visible: true,
              onClick: () => navigate(`/compras?nuevo=true&materialId=${menuTarget.row.id}&materialName=${encodeURIComponent(menuTarget.row.name)}`)
            },
            {
              id: 'ajustar-stock',
              label: '✏️ Ajustar inventario físico',
              icon: Edit3,
              iconClass: 'text-amber-400',
              hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-amber-300',
              visible: true,
              onClick: () => onOpenStockAdjustModal(menuTarget.row)
            }
          ]}
          entityType="materials"
          recordId={menuTarget.recordId}
          recordLabel={menuTarget.recordLabel}
        />
      )}

      {/* BARRA INFERIOR FLOTANTE ESTANDARIZADA (CATÁLOGO DE MATERIALES) */}
      <GridStatusBarBottom
        filteredCount={filteredMaterials.length}
        totalCount={materials.length}
        entityName="materiales"
        hasActiveFilter={Boolean(searchQuery || activeKpiFilter || filterCategory !== 'TODAS' || filterStockOnly)}
        onClearFilters={onClearFilters}
        selectionStats={materialsGrid.selectionStats}
        onClearSelection={() => materialsGrid.setSelectionRange(null)}
        customSelection={materialsGrid.selectedRowIds.size > 0 ? {
          count: materialsGrid.selectedRowIds.size,
          label: 'materiales tildados',
          onClear: materialsGrid.clearRowSelection
        } : null}
        globalAggregates={[
          { label: 'Total Insumos', value: materials.length, highlight: true },
          { label: 'Stock Crítico', value: criticalMaterialsCount },
          { label: 'Con Control Físico', value: stockControlledCount }
        ]}
      />
    </div>
  )
}
