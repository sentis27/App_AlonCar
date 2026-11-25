import { memo } from 'react'
import { Pencil, Trash2, Square, CheckSquare, CopyPlus } from 'lucide-react'
import { computeContractExpiration } from '../../lib/workCostRules'
import { formatDateAr, formatDayMonthAr } from '../../lib/dateTimeCanonical'
import PersonalNominaRowCells from './PersonalNominaRowCells'
import PersonalNominaSafetyCell from './PersonalNominaSafetyCell'

const PERMISSION_DEFS = [
  {
    key: 'P',
    field: 'can_withdraw_materials',
    activeCls: 'bg-emerald-950 text-emerald-400 border border-emerald-600 hover:bg-emerald-900 shadow-sm',
    idleCls: 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800 hover:text-slate-400 line-through',
    sizeCls: 'w-5',
    titleOn: 'Habilitado para retirar de Pañol (P). Clic para deshabilitar.',
    titleOff: 'Deshabilitado para Pañol (P). Clic para habilitar.'
  },
  {
    key: 'H',
    field: 'can_impute_hours',
    activeCls: 'bg-cyan-950 text-cyan-400 border border-cyan-600 hover:bg-cyan-900 shadow-sm',
    idleCls: 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800 hover:text-slate-400 line-through',
    sizeCls: 'w-5',
    titleOn: 'Habilitado para imputar Horas (H). Clic para deshabilitar.',
    titleOff: 'Deshabilitado para Horas (H). Clic para habilitar.'
  },
  {
    key: '3ros',
    field: 'can_charge_third_party',
    activeCls: 'bg-purple-950 text-purple-300 border border-purple-500 hover:bg-purple-900 shadow-sm',
    idleCls: 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800 hover:text-slate-400 line-through',
    sizeCls: 'px-1.5',
    titleOn: 'Habilitado para Terceros / Presupuestos (3ros). Clic para deshabilitar.',
    titleOff: 'Deshabilitado para Terceros (3ros). Clic para habilitar.'
  },
  {
    key: 'JO',
    field: 'is_foreman',
    activeCls: 'bg-amber-950 text-amber-300 border border-amber-500 hover:bg-amber-900 shadow-sm',
    idleCls: 'bg-slate-900 text-slate-600 border border-slate-800 hover:bg-slate-800 hover:text-slate-400',
    sizeCls: 'px-1 text-[9px]',
    titleOn: 'Jefe de Obra habilitado en Órdenes de Trabajo (JO). Clic para desmarcar.',
    titleOff: 'Marcar como Jefe de Obra (JO) para Órdenes de Trabajo.'
  }
]

const PersonalNominaRow = memo(function PersonalNominaRow({
  w,
  rowIndex,
  dollarRate,
  searchTerm,
  uniqueTrades,
  contractExp,
  isRowSelected,
  activeColIndex,
  selStartCol,
  selEndCol,
  fillColIndex,
  fillHandleColIndex,
  editingColKey,
  editingValue,
  gridActions,
  setInlineCellEdit,
  commitInlineWorkerEdit,
  onOpenAddTradeModal,
  onToggleStatus,
  onTogglePermission,
  onEdit,
  onDuplicate,
  onDelete
}) {
  const isActivo = w.status === 'ACTIVO'

  const getCellClass = (colIdx, baseClass = '') => {
    const active = activeColIndex === colIdx
    const fill = fillColIndex === colIdx
    const sel = selStartCol !== -1 && colIdx >= selStartCol && colIdx <= selEndCol
    return `${baseClass} relative cursor-cell ${
      active ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30' :
      fill ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60' :
      sel ? 'bg-cyan-500/15' : ''
    }`
  }

  const renderContractBadge = () => {
    if (w.admin_center !== 'ASTILLERO') return <span className="text-slate-600">—</span>
    const exp = contractExp || computeContractExpiration(w.contract_type, w.contract_start_date)
    if (!exp.hasContract) return <span className="text-slate-500 italic">Sin definir</span>
    if (exp.isPermanent) {
      return (
        <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 font-bold">
          PERMANENTE
        </span>
      )
    }
    return (
      <div className="space-y-0.5" title={exp.expiresIso ? `Inicio: ${formatDateAr(w.contract_start_date)} · Vence: ${formatDateAr(exp.expiresIso)}` : 'Falta fecha de inicio'}>
        <span className={`px-1.5 py-0.5 rounded font-bold border inline-block ${
          exp.isExpired
            ? 'bg-rose-950 text-rose-300 border-rose-600'
            : exp.isExpiringSoon
            ? 'bg-orange-950 text-orange-300 border-orange-500'
            : 'bg-cyan-950/70 text-cyan-300 border-cyan-800'
        }`}>
          {exp.contractType}
        </span>
        {exp.expiresIso && (
          <div className={`text-[9px] font-mono ${exp.needsAttention ? 'text-orange-300 font-bold' : 'text-slate-400'}`}>
            {exp.isExpired ? 'VENCIDO' : `${exp.daysRemaining}d`} · {formatDayMonthAr(exp.expiresIso)}
          </div>
        )}
      </div>
    )
  }

  return (
    <tr
      onContextMenu={(e) => gridActions.onContextMenuRow(w, rowIndex, e, false)}
      className={`group transition-colors select-none ${
        isRowSelected
          ? 'bg-cyan-950/35 hover:bg-cyan-950/45 text-cyan-200'
          : !isActivo
          ? 'opacity-60 bg-rose-950/5 hover:bg-slate-800/40'
          : 'hover:bg-slate-800/40'
      }`}
    >
      {/* Col 0: Checkbox + Número Ordinal (#) Canónico */}
      <td className="py-1 px-1 text-center w-8 select-none relative">
        <div className="flex flex-col items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={() => gridActions.onToggleSelectRow(w.id)}
            className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            {isRowSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => gridActions.onContextMenuRow(w, rowIndex, e, true)}
            className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
              isRowSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'
            }`}
            title={`Fila #${w._rowSeq || rowIndex + 1} • Clic para menú contextual`}
          >
            {w._rowSeq || rowIndex + 1}
          </button>
        </div>
      </td>

      <PersonalNominaRowCells
        w={w}
        rowIndex={rowIndex}
        dollarRate={dollarRate}
        searchTerm={searchTerm}
        uniqueTrades={uniqueTrades}
        gridActions={gridActions}
        getCellClass={getCellClass}
        fillHandleColIndex={fillHandleColIndex}
        editingColKey={editingColKey}
        editingValue={editingValue}
        setInlineCellEdit={setInlineCellEdit}
        commitInlineWorkerEdit={commitInlineWorkerEdit}
        onOpenAddTradeModal={onOpenAddTradeModal}
      />

      {/* Contrato */}
      <td className="py-2 px-1.5 text-[10px]">{renderContractBadge()}</td>

      {/* Estado */}
      <td className="py-2 px-1.5 text-center">
        <button
          type="button"
          onClick={() => onToggleStatus(w)}
          className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
            isActivo
              ? 'bg-emerald-950 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
              : 'bg-rose-950 text-rose-300 border-rose-600 hover:bg-rose-900'
          }`}
          title="Hacé clic para alternar estado Activo/Inactivo"
        >
          {isActivo ? 'ACTIVO' : 'INACTIVO'}
        </button>
      </td>

      {/* Consumibles */}
      <td className="py-2 px-1.5">
        {w.consumables_discount_pct !== undefined && w.consumables_discount_pct !== null ? (
          <span
            title={`Descuento Contratista: ${w.consumables_discount_pct}% | Imputación Obra: ${100 - Number(w.consumables_discount_pct)}%`}
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              Number(w.consumables_discount_pct) === 0
                ? 'bg-purple-950 text-purple-300 border-purple-800'
                : Number(w.consumables_discount_pct) === 100
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : 'bg-blue-950 text-blue-300 border-blue-800'
            }`}
          >
            {Number(w.consumables_discount_pct) === 0
              ? '0% (OBRA)'
              : Number(w.consumables_discount_pct) === 100
              ? '100% (CONT.)'
              : `${w.consumables_discount_pct}% CONT.`}
          </span>
        ) : (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
            w.consumables === 'CLIENTE'
              ? 'bg-purple-950 text-purple-300 border-purple-800'
              : 'bg-amber-950 text-amber-300 border-amber-800'
          }`}>
            {w.consumables || 'CLIENTE'}
          </span>
        )}
      </td>

      {/* Elem. Seg. */}
      <PersonalNominaSafetyCell
        w={w}
        rowIndex={rowIndex}
        cellClassName={getCellClass(6, 'py-2 px-1.5')}
        isEditing={editingColKey === 'safety_items'}
        editingValue={editingColKey === 'safety_items' ? editingValue : ''}
        showFillHandle={fillHandleColIndex === 6}
        gridActions={gridActions}
        setInlineCellEdit={setInlineCellEdit}
        commitInlineWorkerEdit={commitInlineWorkerEdit}
      />

      {/* Permisos */}
      <td className="py-2 px-1.5 text-center">
        <div className="flex items-center justify-center gap-1">
          {PERMISSION_DEFS.map((p) => {
            const active = Boolean(w[p.field])
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onTogglePermission(w, p.key)}
                className={`${p.sizeCls} h-5 rounded flex items-center justify-center text-[10px] font-black transition-all cursor-pointer ${active ? p.activeCls : p.idleCls}`}
                title={active ? p.titleOn : p.titleOff}
              >
                {p.key}
              </button>
            )
          })}
        </div>
      </td>

      {/* Acciones */}
      <td className="py-2 px-2 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(w)}
            className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Editar operario"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(w)}
            className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-amber-500/10 transition-colors cursor-pointer"
            title="Duplicar fila"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(w)}
            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Eliminar de la nómina"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
})

export default PersonalNominaRow
