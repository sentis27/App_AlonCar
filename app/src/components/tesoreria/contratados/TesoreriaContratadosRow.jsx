/**
 * TesoreriaContratadosRow.jsx
 * Fila individual de la planilla `3. Contratados` (fila de tabla sin envoltorio propio) con edición in-situ
 * por doble clic (`onBlur` blindado) y badges canónicos PRC / OT / DEBE FACTURA.
 */
import React from 'react'
import { Edit3, FileWarning, Lock, Trash2 } from 'lucide-react'
import CanonicalOtBadge from '../../canonical/CanonicalOtBadge'
import CanonicalPrcBadge from '../../canonical/CanonicalPrcBadge'
import HighlightText from '../../HighlightText'
import { formatDateAr } from '../../../lib/dateTimeCanonical'
import { formatLedgerMoney } from '../../../lib/contractorLedgerHelpers'

const CELL_INPUT_CLS = 'w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none'

const ORIGIN_STYLE = {
  PRC_REGISTRY: 'bg-amber-950/90 text-amber-300 border-amber-500/50',
  HOURS_LIVE: 'bg-purple-950/90 text-purple-300 border-purple-500/50',
  CC_MOVEMENT: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  WORKSHOP_DEBE: 'bg-sky-950/90 text-sky-300 border-sky-500/40',
  WORKSHOP_PAYMENT: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  WORKSHOP_OPENING: 'bg-slate-800 text-slate-300 border-slate-600',
}

export default function TesoreriaContratadosRow({
  row,
  rowIdx,
  currency = 'ARS',
  showShipTag = false,
  sheet,
  searchTerm = '',
  workOrders = [],
  workItems = [],
  canManageCc = false,
  editingCell = null,
  onStartEditCell,
  onChangeEditValue,
  onCommitEditCell,
  onCancelEditCell,
  onEditRow,
  onQuickResolveInvoice,
  onDeleteRow,
}) {
  const isWorkshopPay = row.origin === 'WORKSHOP_PAYMENT'
  const canInline = Boolean(canManageCc && row.isEditable)
  const isEditing = (field) => editingCell?.rowId === row.id && editingCell?.field === field

  const startEdit = (field, initialVal) => {
    if (!canInline) return
    if (isWorkshopPay && (field === 'concept' || field === 'accruedAmount')) return
    onStartEditCell?.({ rowId: row.id, field, value: String(initialVal ?? ''), row })
  }

  const onInputKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onCommitEditCell?.() }
    else if (e.key === 'Escape') { e.preventDefault(); onCancelEditCell?.() }
  }

  const cConcept = sheet.getCellProps(rowIdx, 'concept')
  const cDate = sheet.getCellProps(rowIdx, 'entryDate')
  const cPaid = sheet.getCellProps(rowIdx, 'paidAmount')
  const cAccrued = sheet.getCellProps(rowIdx, 'accruedAmount')
  const cBal = sheet.getCellProps(rowIdx, 'runningBalance')
  const cRef = sheet.getCellProps(rowIdx, 'refDisplay')
  const cObs = sheet.getCellProps(rowIdx, 'observations')

  const bal = Number(row.activeRunningBalance ?? row.runningBalance ?? 0)
  const balCls = bal < -0.005 ? 'text-rose-300' : bal > 0.005 ? 'text-cyan-300' : 'text-emerald-300'
  const readOnlyTitle = row.origin === 'PRC_REGISTRY'
    ? 'Dato automático de Base de PRC (#2000+). Se gestiona desde Terceros u OTs.'
    : row.origin === 'HOURS_LIVE'
    ? 'Dato automático calculado desde Carga de Horas y Tarifario.'
    : row.origin === 'WORKSHOP_DEBE'
    ? 'Remito de taller calculado desde Control Pampa / Terceros.'
    : 'Movimiento editable de Cuenta Corriente'

  return (
    <tr className={`transition-colors align-top ${row.accruedAmount > 0 ? 'bg-slate-900/45 hover:bg-slate-900/80' : 'hover:bg-slate-900/70'}`}>
      <td className="py-1.5 px-2 text-center whitespace-nowrap">
        <div className="font-mono text-[10px] text-slate-500">{rowIdx + 1}</div>
        <span
          title={readOnlyTitle}
          className={`inline-block mt-0.5 px-1 py-0.2 rounded border text-[8px] font-black tracking-tight ${ORIGIN_STYLE[row.origin] || ORIGIN_STYLE.CC_MOVEMENT}`}
        >
          {row.originLabel}
        </span>
      </td>

      <td
        {...cConcept.domProps}
        onDoubleClick={() => startEdit('concept', row.concept)}
        className={`py-1.5 px-2 min-w-[210px] ${cConcept.className}`}
      >
        {isEditing('concept') ? (
          <input
            autoFocus
            type="text"
            value={editingCell.value}
            onChange={(e) => onChangeEditValue?.(e.target.value)}
            onBlur={() => onCommitEditCell?.()}
            onKeyDown={onInputKey}
            className={CELL_INPUT_CLS}
          />
        ) : (
          <div className={row.accruedAmount > 0 ? 'font-extrabold text-amber-100' : 'text-slate-200'}>
            <HighlightText text={row.concept} query={searchTerm} />
            {showShipTag && row.shipName && (
              <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[9px] font-bold text-cyan-300">
                <HighlightText text={row.shipName} query={searchTerm} />
              </span>
            )}
          </div>
        )}
      </td>

      <td
        {...cDate.domProps}
        onDoubleClick={() => startEdit('entryDate', row.entryDate)}
        className={`py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap ${cDate.className}`}
      >
        {isEditing('entryDate') ? (
          <input
            autoFocus
            type="date"
            value={editingCell.value}
            onChange={(e) => onChangeEditValue?.(e.target.value)}
            onBlur={() => onCommitEditCell?.()}
            onKeyDown={onInputKey}
            className={`${CELL_INPUT_CLS} font-mono w-[128px]`}
          />
        ) : formatDateAr(row.entryDate)}
      </td>

      <td
        {...cPaid.domProps}
        onDoubleClick={() => startEdit('paidAmount', row.paidAmount || '')}
        className={`py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap text-emerald-300 ${cPaid.className}`}
      >
        {isEditing('paidAmount') ? (
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            value={editingCell.value}
            onChange={(e) => onChangeEditValue?.(e.target.value)}
            onBlur={() => onCommitEditCell?.()}
            onKeyDown={onInputKey}
            className={`${CELL_INPUT_CLS} text-right font-mono`}
          />
        ) : formatLedgerMoney(row.paidAmount, currency, { showZeroAsDash: true })}
      </td>

      <td
        {...cAccrued.domProps}
        onDoubleClick={() => startEdit('accruedAmount', row.accruedAmount || '')}
        className={`py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap text-amber-300 ${cAccrued.className}`}
      >
        {isEditing('accruedAmount') ? (
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            value={editingCell.value}
            onChange={(e) => onChangeEditValue?.(e.target.value)}
            onBlur={() => onCommitEditCell?.()}
            onKeyDown={onInputKey}
            className={`${CELL_INPUT_CLS} text-right font-mono`}
          />
        ) : formatLedgerMoney(row.accruedAmount, currency, { showZeroAsDash: true })}
      </td>

      <td {...cBal.domProps} className={`py-1.5 px-2 text-right font-mono font-black whitespace-nowrap ${balCls} ${cBal.className}`}>
        {formatLedgerMoney(bal, currency)}
      </td>

      <td
        {...cRef.domProps}
        onDoubleClick={() => startEdit('invoiceNumber', row.invoiceNumber || '')}
        className={`py-1.5 px-2 whitespace-nowrap ${cRef.className}`}
      >
        {isEditing('invoiceNumber') ? (
          <input
            autoFocus
            type="text"
            value={editingCell.value}
            onChange={(e) => onChangeEditValue?.(e.target.value)}
            onBlur={() => onCommitEditCell?.()}
            onKeyDown={onInputKey}
            placeholder="Nº Factura..."
            className={`${CELL_INPUT_CLS} font-mono`}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {row.prcRecord && (
              <CanonicalPrcBadge prc={row.prcRecord} additionals={row.prcAdditionals} variant="pill" searchQuery={searchTerm} />
            )}
            {row.workOrder && (
              <CanonicalOtBadge
                wo={row.workOrder}
                ship={row.shipRecord}
                workItems={workItems}
                workOrders={workOrders}
                searchQuery={searchTerm}
                variant="compact"
              />
            )}
            {row.invoiceStatus === 'DEBE_FACTURA' && canInline ? (
              <button
                type="button"
                onClick={() => onQuickResolveInvoice?.(row)}
                title="Clic para cargar Nº de Factura recibida"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-950/90 text-rose-300 border border-rose-500/70 cursor-pointer hover:brightness-110"
              >
                <FileWarning className="w-2.5 h-2.5" />
                <span>DEBE FACTURA</span>
              </button>
            ) : row.invoiceNumber ? (
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-200">
                <HighlightText text={row.invoiceNumber} query={searchTerm} />
              </span>
            ) : (!row.prcRecord && !row.workOrder && row.refDisplay) ? (
              <span className="text-[10px] font-mono text-slate-400">
                <HighlightText text={row.refDisplay} query={searchTerm} />
              </span>
            ) : null}
          </div>
        )}
      </td>

      <td
        {...cObs.domProps}
        onDoubleClick={() => startEdit('observations', row.observations)}
        className={`py-1.5 px-2 max-w-[220px] text-[11px] text-slate-300 ${cObs.className}`}
      >
        {isEditing('observations') ? (
          <input
            autoFocus
            type="text"
            value={editingCell.value}
            onChange={(e) => onChangeEditValue?.(e.target.value)}
            onBlur={() => onCommitEditCell?.()}
            onKeyDown={onInputKey}
            className={CELL_INPUT_CLS}
          />
        ) : <HighlightText text={row.observations || '—'} query={searchTerm} />}
      </td>

      <td className="py-1.5 px-2 whitespace-nowrap text-right">
        {canInline ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEditRow?.(row)}
              title="Editar movimiento completo"
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteRow?.(row)}
              title="Eliminar movimiento"
              className="p-1 rounded-lg bg-rose-950/70 hover:bg-rose-800/70 text-rose-300 border border-rose-500/40 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span title={readOnlyTitle} className="inline-flex items-center justify-center p-1 text-slate-600">
            <Lock className="w-3 h-3" />
          </span>
        )}
      </td>
    </tr>
  )
}
