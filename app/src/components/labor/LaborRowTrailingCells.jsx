import React from 'react'
import { AlertCircle, Pencil, CopyPlus, Trash2 } from 'lucide-react'
import HighlightText from '../HighlightText.jsx'
import LaborInlineCell from './LaborInlineCell.jsx'

function getApprovalSelectTone(status) {
  if (status === 'S' || status === 'Aprobado') return 'text-emerald-400 border-emerald-700/60'
  if (status === 'R') return 'text-rose-400 border-rose-500/70'
  if (status === 'RR') return 'text-amber-400 border-amber-500/70'
  if (status === 'RRR') return 'text-cyan-400 border-cyan-500/70'
  return 'text-slate-400 border-slate-700'
}

export default function LaborRowTrailingCells({
  log,
  rowIndex,
  shipDisplayName,
  otTitle,
  filterWorker,
  isEditingNotes,
  notesEditInput,
  getHorasCellProps,
  activateHorasCell,
  onUpdateApprovalStatus,
  onOpenReviewReason,
  onEditFromDaily,
  onDuplicateLog,
  onDeleteLog,
  onFillHandleMouseDown,
  onFillHandleDoubleClick
}) {
  return (
    <>
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
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none bg-slate-950 ${getApprovalSelectTone(log.approval_status)}`}
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
              className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-900/40 transition-colors cursor-pointer"
              title={`Motivo de observación (R): ${log.review_reason}`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>
      </LaborInlineCell>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'notes')}
        onDoubleClick={() => activateHorasCell(log, 'notes')}
        className="py-2 px-2.5 cursor-pointer max-w-[160px]"
        title={log.notes || 'Doble clic para editar Observaciones / Tarea'}
        isEditing={isEditingNotes}
        editInput={notesEditInput}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <span className={`block truncate text-[11px] ${log.notes ? 'text-slate-300' : 'text-slate-600 italic'}`}>
          <HighlightText text={log.notes || '—'} query={filterWorker} />
        </span>
      </LaborInlineCell>

      <td className="py-2 px-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => onEditFromDaily(log)} className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 cursor-pointer" title="Editar en ventana">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onDuplicateLog(log)} className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-amber-500/10 cursor-pointer" title="Duplicar fila">
            <CopyPlus className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onDeleteLog(log.id, log.worker_name)} className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 cursor-pointer" title="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </>
  )
}
