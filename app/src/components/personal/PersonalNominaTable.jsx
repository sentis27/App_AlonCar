import { Square, CheckSquare, HelpCircle } from 'lucide-react'
import GridRibbon from '../GridRibbon'
import PersonalNominaRow from './PersonalNominaRow'
import { SAFETY_ITEMS_HELP_TEXT } from '../../lib/workCostRules'

export default function PersonalNominaTable({
  nominaGrid,
  filteredWorkers,
  dollarRate,
  searchTerm,
  uniqueTrades,
  inlineCellEdit,
  setInlineCellEdit,
  commitInlineWorkerEdit,
  contextMenuTarget,
  setContextMenuTarget,
  onOpenNew,
  onOpenAddTradeModal,
  onToggleStatus,
  onTogglePermission,
  onEdit,
  onDuplicate,
  onDelete
}) {
  return (
    <div
      ref={nominaGrid.gridContainerRef}
      tabIndex={0}
      onKeyDown={nominaGrid.handleKeyDown}
      className="alon-zone-grid rounded-2xl shadow-xl overflow-hidden focus:outline-none"
    >
      <GridRibbon
        activeCellBadge={nominaGrid.activeCellBadge || 'PADRÓN OPERATIVO'}
        onInsertRow={onOpenNew}
        insertRowLabel="Cargar Operario / Contratista"
        undoCount={nominaGrid.undoStack?.length || 0}
        totalRows={filteredWorkers.length}
        entityName="operarios"
        exportRows={filteredWorkers}
        exportFilename={`personal_padron_${new Date().toISOString().split('T')[0]}`}
      />

      <div className="alon-grid-scroll">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 z-20 alon-grid-thead text-[10px] uppercase font-bold text-slate-300 shadow-sm backdrop-blur-md">
            <tr>
              <th className="py-2 px-1 text-center w-8 select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => nominaGrid.toggleSelectAll(filteredWorkers.map((w) => w.id))}
                    className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Seleccionar todas las filas visibles"
                  >
                    {nominaGrid.selectedRowIds.size > 0 && nominaGrid.selectedRowIds.size === filteredWorkers.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                </div>
              </th>
              <th className="py-2.5 px-2">Nombre y Apellido ✎</th>
              <th className="py-2.5 px-1.5 text-center">Categoría ✎</th>
              <th className="py-2.5 px-1.5">Rubro ✎</th>
              <th className="py-2.5 px-2 text-right">AR$/Hora ✎</th>
              <th className="py-2.5 px-1.5 text-center text-emerald-400">U$/Hora</th>
              <th className="py-2.5 px-2">Grupo de Trabajo ✎</th>
              <th className="py-2.5 px-1.5">Centro Admin ✎</th>
              <th className="py-2.5 px-1.5">Contrato</th>
              <th className="py-2.5 px-1.5 text-center">Estado</th>
              <th className="py-2.5 px-1.5">Consumibles</th>
              <th className="py-2.5 px-1.5">
                <div className="relative group inline-flex items-center gap-1 cursor-help">
                  <span>Elem. Seg. ✎</span>
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-150 absolute top-full right-0 mt-1.5 w-80 p-3 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-2xl z-50 text-left font-normal normal-case tracking-normal text-[11px] leading-relaxed text-slate-200">
                    <div className="font-black text-cyan-300 mb-1 uppercase text-[10px]">
                      Regla Unificada: Elementos de Seguridad (EPP)
                    </div>
                    <p>{SAFETY_ITEMS_HELP_TEXT}</p>
                  </div>
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-center">Permisos</th>
              <th className="py-2.5 px-2 text-right whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filteredWorkers.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-slate-500">
                  No se encontraron registros que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredWorkers.map((w, rowIndex) => (
                <PersonalNominaRow
                  key={w.id}
                  w={w}
                  rowIndex={rowIndex}
                  dollarRate={dollarRate}
                  searchTerm={searchTerm}
                  uniqueTrades={uniqueTrades}
                  nominaGrid={nominaGrid}
                  inlineCellEdit={inlineCellEdit}
                  setInlineCellEdit={setInlineCellEdit}
                  commitInlineWorkerEdit={commitInlineWorkerEdit}
                  contextMenuTarget={contextMenuTarget}
                  setContextMenuTarget={setContextMenuTarget}
                  onOpenAddTradeModal={onOpenAddTradeModal}
                  onToggleStatus={onToggleStatus}
                  onTogglePermission={onTogglePermission}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
