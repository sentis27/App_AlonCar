import React from 'react'
import { AlertCircle, Pencil, CopyPlus, Trash2 } from 'lucide-react'
import HighlightText from '../HighlightText.jsx'
import { cleanShipName } from '../../lib/laborConstants.js'
import LaborInlineCell from './LaborInlineCell.jsx'

const NUMERIC_HOUR_CELLS = [
  {
    field: 'hours_normal',
    title: 'Doble clic para editar Horas Normales',
    cellClass: 'py-2 px-2 text-center font-mono cursor-pointer',
    getDisplay: (log) => log.hours_normal ?? log.hours_worked ?? 0
  },
  {
    field: 'hours_extra_50',
    title: 'Doble clic para editar Horas 50%',
    cellClass: 'py-2 px-2 text-center font-mono text-cyan-400 cursor-pointer',
    getDisplay: (log) => log.hours_extra_50 || 0
  },
  {
    field: 'hours_extra_100',
    title: 'Doble clic para editar Horas 100%',
    cellClass: 'py-2 px-2 text-center font-mono text-amber-400 cursor-pointer',
    getDisplay: (log) => log.hours_extra_100 || 0
  }
]

export default function LaborLogsTableRow({
  log,
  rowIndex,
  isSelected,
  filterWorker,
  inlineLogEdit,
  setInlineLogEdit,
  getHorasCellProps,
  activateHorasCell,
  saveInlineLogEdit,
  onToggleSelectLog,
  onUpdateApprovalStatus,
  onOpenReviewReason,
  onEditFromDaily,
  onDuplicateLog,
  onDeleteLog,
  onOpenContextMenu,
  onFillHandleMouseDown,
  onFillHandleDoubleClick
}) {
  const shipDisplayName = cleanShipName(log.ships?.name || log.work_orders?.ships?.name || '') || 'Sin Buque'
  const otNumber = log.work_orders?.ot_number
  const otTitle = log.work_orders?.title

  const isEditingField = (field) => inlineLogEdit.id === log.id && inlineLogEdit.field === field
  const cancelInlineEdit = () => setInlineLogEdit({ id: null, field: null, value: '' })

  const renderInlineInput = (field, { type = 'text', list, step, min, max, className }) => (
    <input
      type={type}
      list={list}
      step={step}
      min={min}
      max={max}
      autoFocus
      value={inlineLogEdit.value}
      onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveInlineLogEdit(log.id, field, inlineLogEdit.value)
        if (e.key === 'Escape') cancelInlineEdit()
      }}
      onBlur={() => saveInlineLogEdit(log.id, field, inlineLogEdit.value)}
      className={className}
    />
  )

  return (
    <tr
      onContextMenu={(e) => onOpenContextMenu(e, log, rowIndex)}
      className={`transition-colors select-none ${
        isSelected ? 'bg-cyan-950/50 hover:bg-cyan-950/70 border-l-2 border-l-cyan-400' : 'hover:bg-slate-800/30'
      }`}
    >
      <td className="py-1 px-1 text-center whitespace-nowrap w-9">
        <div className="flex flex-col items-center justify-center gap-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelectLog(log.id)}
            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
          />
          <span
            className="font-mono text-[9px] text-slate-500 font-bold leading-none select-none"
            title={`Fila #${log._rowSeq || rowIndex + 1} (DNI Inviolable)`}
          >
            {log._rowSeq || rowIndex + 1}
          </span>
        </div>
      </td>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'date_logged')}
        onDoubleClick={() => activateHorasCell(log, 'date_logged')}
        className="py-2 px-3 font-mono text-slate-300 cursor-pointer whitespace-nowrap"
        title="Doble clic para editar Fecha"
        isEditing={isEditingField('date_logged')}
        editInput={renderInlineInput('date_logged', {
          type: 'date',
          className: 'bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none'
        })}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <span><HighlightText text={log.date_logged} query={filterWorker} /></span>
      </LaborInlineCell>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'ship_wo')}
        onDoubleClick={() => activateHorasCell(log, 'ship_wo')}
        className="py-2 px-3 cursor-pointer"
        title="Doble clic para cambiar Buque u Orden de Trabajo"
        isEditing={false}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <span className="font-semibold text-white block truncate max-w-[160px]">
          <HighlightText text={shipDisplayName} query={filterWorker} />
        </span>
        {log.work_order_id ? (
          <span className="text-[11px] text-slate-400 block truncate max-w-[160px]">
            {otNumber ? <strong className="text-cyan-300 font-mono mr-1"><HighlightText text={otNumber} query={filterWorker} /></strong> : null}
            <HighlightText text={otTitle || 'OT'} query={filterWorker} />
          </span>
        ) : (
          <span className="text-[10px] text-amber-400 font-bold">⚠️ Sin OT (Doble clic)</span>
        )}
      </LaborInlineCell>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'worker_name')}
        onDoubleClick={() => activateHorasCell(log, 'worker_name')}
        className="py-2 px-3 cursor-pointer"
        title="Doble clic para cambiar Operario"
        isEditing={isEditingField('worker_name')}
        editInput={renderInlineInput('worker_name', {
          type: 'text',
          list: 'all-workers-datalist',
          className: 'w-full min-w-[140px] bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none'
        })}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-200">
            <HighlightText text={log.worker_name} query={filterWorker} />
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              log.worker_type === 'Astillero'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                : log.worker_type === 'Taller'
                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
            }`}
          >
            <HighlightText text={log.worker_type || 'Astillero'} query={filterWorker} />
          </span>
        </div>
      </LaborInlineCell>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'rubro')}
        onDoubleClick={() => activateHorasCell(log, 'rubro')}
        className="py-2 px-3 cursor-pointer"
        title="Doble clic para editar Rubro"
        isEditing={isEditingField('rubro')}
        editInput={renderInlineInput('rubro', {
          type: 'text',
          list: 'rubros-list-carga',
          className: 'w-32 bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none'
        })}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <span
          className={`px-2 py-0.5 rounded text-[11px] ${
            (log.rubro || '').toLowerCase().includes('feriado')
              ? 'bg-amber-950 text-amber-300 border border-amber-700/80 font-bold'
              : 'bg-slate-800 text-slate-300'
          }`}
        >
          <HighlightText text={log.rubro || 'General'} query={filterWorker} />
        </span>
      </LaborInlineCell>

      {NUMERIC_HOUR_CELLS.map((cfg) => (
        <LaborInlineCell
          key={cfg.field}
          cellProps={getHorasCellProps(rowIndex, cfg.field)}
          onDoubleClick={() => activateHorasCell(log, cfg.field)}
          className={cfg.cellClass}
          title={cfg.title}
          isEditing={isEditingField(cfg.field)}
          editInput={renderInlineInput(cfg.field, {
            type: 'number',
            step: '0.5',
            min: '0',
            max: '24',
            className: 'w-14 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-center text-xs text-white focus:outline-none font-mono'
          })}
          onFillHandleMouseDown={onFillHandleMouseDown}
          onFillHandleDoubleClick={onFillHandleDoubleClick}
        >
          <span><HighlightText text={cfg.getDisplay(log)} query={filterWorker} /></span>
        </LaborInlineCell>
      ))}

      <td className="py-2 px-3 text-center font-mono font-bold text-primary whitespace-nowrap">
        <HighlightText text={`${log.hours_worked} hs`} query={filterWorker} />
      </td>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'approval_status')}
        className="py-2 px-2 text-center"
        isEditing={false}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <div className="flex items-center justify-center gap-1">
          <select
            value={log.approval_status || ''}
            onChange={(e) => onUpdateApprovalStatus(log.id, e.target.value)}
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none bg-slate-950 ${
              log.approval_status === 'S' || log.approval_status === 'Aprobado'
                ? 'text-emerald-400 border-emerald-700/60'
                : log.approval_status === 'R'
                ? 'text-rose-400 border-rose-500/70'
                : log.approval_status === 'RR'
                ? 'text-amber-400 border-amber-500/70'
                : log.approval_status === 'RRR'
                ? 'text-cyan-400 border-cyan-500/70'
                : 'text-slate-400 border-slate-700'
            }`}
            title={`Estado de revisión de ${log.worker_name}`}
          >
            <option value="">-</option>
            <option value="S">S (Aprobado)</option>
            <option value="R">R (Revisión)</option>
            <option value="RR">RR (Corregido)</option>
            <option value="RRR">RRR (Aprobado Fin)</option>
          </select>
          {log.review_reason && (
            <button
              type="button"
              onClick={() => onOpenReviewReason(log, shipDisplayName, otTitle)}
              className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-900/40 transition-colors"
              title={`Motivo de observación (R): ${log.review_reason}`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>
      </LaborInlineCell>

      <td className="py-2 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEditFromDaily(log)}
            className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800"
            title="Editar en ventana"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateLog(log)}
            className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-amber-500/10"
            title="Duplicar fila"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteLog(log.id, log.worker_name)}
            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
