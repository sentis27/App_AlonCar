import React from 'react'
import HighlightText from '../HighlightText.jsx'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge.jsx'
import { cleanShipName } from '../../lib/laborConstants.js'
import { formatDateAr } from '../../lib/dateTimeCanonical.js'
import { TIPOS_DE_TRABAJO } from '../../lib/workOrdersConstants.js'
import { normalizeLaborWorkType, getWorkTypeBadgeMeta } from '../../lib/laborCargaGridHelpers.js'
import LaborInlineCell from './LaborInlineCell.jsx'
import LaborRowTrailingCells from './LaborRowTrailingCells.jsx'

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
  ships = [],
  workOrders = [],
  workItems = [],
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
  const resolvedWo = (log.work_order_id && workOrders.find((w) => String(w.id) === String(log.work_order_id))) || log.work_orders || null
  const resolvedShip = ships.find((s) => String(s.id) === String(log.ship_id || resolvedWo?.ship_id)) || log.ships || log.work_orders?.ships || null
  const otTitle = resolvedWo?.title || log.work_orders?.title

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
        <span><HighlightText text={formatDateAr(log.date_logged)} query={filterWorker} /></span>
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
        <CanonicalOtBadge
          wo={log.work_order_id ? resolvedWo : null}
          ship={resolvedShip}
          workItems={workItems}
          workOrders={workOrders}
          searchQuery={filterWorker}
          variant="compact"
          sinOtLabel="Sin OT (Doble clic)"
          className="text-[11px] text-slate-400 max-w-[165px]"
        />
      </LaborInlineCell>

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'worker_name')}
        onDoubleClick={() => activateHorasCell(log, 'worker_name')}
        className="py-2 px-2.5 cursor-pointer"
        title="Doble clic para elegir Operario o Contratista habilitado"
        isEditing={false}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        <div className="flex items-center gap-1.5">
          <span className={`font-medium ${log.worker_name ? 'text-slate-200' : 'text-amber-400 italic'}`}>
            <HighlightText text={log.worker_name || '⚠️ Sin operario'} query={filterWorker} />
          </span>
          {log.worker_type && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                log.worker_type === 'Astillero'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                  : log.worker_type === 'Taller'
                  ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
              }`}
            >
              <HighlightText text={log.worker_type} query={filterWorker} />
            </span>
          )}
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

      <LaborInlineCell
        cellProps={getHorasCellProps(rowIndex, 'work_type')}
        onDoubleClick={() => activateHorasCell(log, 'work_type')}
        className="py-2 px-2 text-center cursor-pointer whitespace-nowrap"
        title="Doble clic o Enter para elegir Modalidad (Col. F: Hora / Presupuesto / Control)"
        isEditing={isEditingField('work_type')}
        editInput={
          <select
            autoFocus
            value={normalizeLaborWorkType(inlineLogEdit.value, 'HORA')}
            onChange={(e) => {
              const nextVal = e.target.value
              setInlineLogEdit({ ...inlineLogEdit, value: nextVal })
              saveInlineLogEdit(log.id, 'work_type', nextVal)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveInlineLogEdit(log.id, 'work_type', e.target.value)
              if (e.key === 'Escape') cancelInlineEdit()
            }}
            onBlur={() => cancelInlineEdit()}
            className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] font-bold text-white focus:outline-none"
          >
            {TIPOS_DE_TRABAJO.map((t) => (
              <option key={t.value} value={t.value} className="bg-slate-900 text-white">
                {t.value}
              </option>
            ))}
          </select>
        }
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      >
        {(() => {
          const wt = getWorkTypeBadgeMeta(log.work_type)
          return (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${wt.cls}`}
              title={`Modalidad Col. F: ${wt.label}`}
            >
              <HighlightText text={wt.code} query={filterWorker} />
            </span>
          )
        })()}
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

      <LaborRowTrailingCells
        log={log}
        rowIndex={rowIndex}
        shipDisplayName={shipDisplayName}
        otTitle={otTitle}
        filterWorker={filterWorker}
        isEditingNotes={isEditingField('notes')}
        notesEditInput={renderInlineInput('notes', {
          type: 'text',
          className: 'w-36 bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none'
        })}
        getHorasCellProps={getHorasCellProps}
        activateHorasCell={activateHorasCell}
        onUpdateApprovalStatus={onUpdateApprovalStatus}
        onOpenReviewReason={onOpenReviewReason}
        onEditFromDaily={onEditFromDaily}
        onDuplicateLog={onDuplicateLog}
        onDeleteLog={onDeleteLog}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onFillHandleDoubleClick={onFillHandleDoubleClick}
      />
    </tr>
  )
}
