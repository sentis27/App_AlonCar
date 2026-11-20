import { useState } from 'react'
import {
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
import HighlightText from '../HighlightText'
import GasTraceabilityGrid from './GasTraceabilityGrid'
import PanolCatalogGrid from './PanolCatalogGrid'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function PanolStockPanel({
  activeTab,
  filteredMaterials,
  materials,
  rubros = [],
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
  traceSupplierFilter: propTraceSupplierFilter,
  setTraceSupplierFilter: propSetTraceSupplierFilter,
  traceMaterialFilter: propTraceMaterialFilter,
  setTraceMaterialFilter: propSetTraceMaterialFilter,
  isAdmin,
  user,
  criticalMaterialsCount,
  stockControlledCount,
  onClearFilters,
  onOpenEditMaterialModal = null,
  onOpenStockAdjustModal,
  onOpenConsumption6MModal = null,
  onOpenWithdrawalModal,
  onOpenGasFinalReturnModal = null,
  onOpenGasSupplierModal = null,
  onPreviewImage,
  showFeedback,
  fetchData,
  setMaterials
}) {
  const [localTraceSupplierFilter, setLocalTraceSupplierFilter] = useState('TODOS')
  const [localTraceMaterialFilter, setLocalTraceMaterialFilter] = useState('TODOS')
  const traceSupplierFilter = propTraceSupplierFilter ?? localTraceSupplierFilter
  const setTraceSupplierFilter = propSetTraceSupplierFilter ?? setLocalTraceSupplierFilter
  const traceMaterialFilter = propTraceMaterialFilter ?? localTraceMaterialFilter
  const setTraceMaterialFilter = propSetTraceMaterialFilter ?? setLocalTraceMaterialFilter

  // ==============================================================================
  // RENDER PESTAÃ‘A 2: CONTROL DE GASES
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
                            <span>Â± Remito</span>
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
                        <span className="block text-[9px] text-rose-400 font-bold uppercase">VacÃ­os</span>
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
                                {' Â· '}
                                <span className="text-rose-300">{g.empty}Vc</span>
                                {g.withContractors > 0 && (
                                  <span className="text-amber-300"> Â· {g.withContractors}Ob</span>
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
              Regla P-01: Alerta ante retenciÃ³n mayor a 15 dÃ­as sin rotaciÃ³n
            </span>
          </div>

          <div className="alon-grid-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 alon-grid-thead">
                <tr>
                  <th className="py-2.5 px-3">Contratista / Taller</th>
                  <th className="py-2.5 px-3 text-center">Tubos en Poder</th>
                  <th className="py-2.5 px-3">Detalle por Gas / Marca y Recambios</th>
                  <th className="py-2.5 px-3">Estado de RetenciÃ³n</th>
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
                                title="Recambio 1x1 mantiene deuda neta en +0 (trajo vacÃ­o y retirÃ³ lleno)"
                              >
                                ðŸ”„ {data.exchangesCount} recambio{data.exchangesCount === 1 ? '' : 's'} 1x1
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
                                <span className="text-amber-400">Â· {h.supplierName}</span>
                              </span>
                            ))}
                            {exchangesByBrand.map((ex) => (
                              <span
                                key={ex.key}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/50 border border-sky-700/50 text-sky-200 text-[10px]"
                              >
                                <span className="font-mono font-bold text-sky-300">ðŸ”„ {ex.qty}x</span>
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
                              <span>{longHeld.days} dÃ­as retenidos (&gt;15d)</span>
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
                                title="Elegir y devolver tubo(s) vacÃ­o(s) en poder de este contratista"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-300" />
                                <span>DevoluciÃ³n Final</span>
                              </button>
                            )}
                            {longHeld && (
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = `Hola ${cName}, desde PaÃ±ol Alon Car te recordamos que poseen cilindros de gas con mÃ¡s de ${longHeld.days} dÃ­as de retiro. Por favor coordinar recambio o devoluciÃ³n final para evitar cargos de alquiler. Muchas gracias.`
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

        {/* Tabla CronolÃ³gica Completa de Trazabilidad (Gaseras + Contratistas) */}
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
  // RENDER PESTAÃ‘A 4: CONTROL EPP
  // ==============================================================================
  if (activeTab === 'epp') {
    return (
      <div className="alon-zone-grid p-6 text-center text-slate-400 space-y-3 font-sans">
        <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Registro y Control de Elementos de ProtecciÃ³n Personal (EPP)</h2>
        <p className="text-xs max-w-md mx-auto">
          Consolidado histÃ³rico de entregas de botines, cascos, antiparras y guantes asignados a cada operario y contratista.
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
  // RENDER PESTAÃ‘A 3: CATÃLOGO B.D MATERIALES & STOCK
  // ==============================================================================
  return (
    <PanolCatalogGrid
      filteredMaterials={filteredMaterials}
      materials={materials}
      rubros={rubros}
      searchQuery={searchQuery}
      activeKpiFilter={activeKpiFilter}
      filterCategory={filterCategory}
      filterStockOnly={filterStockOnly}
      isAdmin={isAdmin}
      user={user}
      criticalMaterialsCount={criticalMaterialsCount}
      stockControlledCount={stockControlledCount}
      onClearFilters={onClearFilters}
      onOpenEditMaterialModal={onOpenEditMaterialModal}
      onOpenStockAdjustModal={onOpenStockAdjustModal}
      onOpenConsumption6MModal={onOpenConsumption6MModal}
      onPreviewImage={onPreviewImage}
      showFeedback={showFeedback}
      fetchData={fetchData}
      setMaterials={setMaterials}
    />
  )
}
