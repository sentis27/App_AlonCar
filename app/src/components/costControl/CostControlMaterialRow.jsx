import { useState } from 'react'
import { Calendar, Pencil, AlertTriangle, Check, Undo2 } from 'lucide-react'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge.jsx'
import HighlightText from '../HighlightText.jsx'

export default function CostControlMaterialRow({
  row,
  rowIdx,
  isFocused,
  isChecked,
  shipObj,
  woObj,
  workItems,
  workOrders,
  searchQuery,
  sheet,
  saving,
  onFocusRow,
  onToggleSelectTx,
  onOpenShipOtModal,
  onBatchUpdate,
  onValidateException,
  onRevokeReview,
}) {
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState(row.dateIso || '')
  const [editingException, setEditingException] = useState(false)
  const [exceptionReason, setExceptionReason] = useState('')

  const dateCell = sheet.getCellProps(rowIdx, 'date')
  const voucherCell = sheet.getCellProps(rowIdx, 'voucher')
  const matCell = sheet.getCellProps(rowIdx, 'material')
  const entCell = sheet.getCellProps(rowIdx, 'entity')
  const shipOtCell = sheet.getCellProps(rowIdx, 'shipOt')
  const statusCell = sheet.getCellProps(rowIdx, 'status')

  const startDateEdit = () => {
    setDateDraft(row.dateIso || '')
    setEditingDate(true)
  }

  const commitDateEdit = async () => {
    const nextIso = String(dateDraft || '').trim()
    setEditingDate(false)
    if (!nextIso || nextIso === row.dateIso) return
    await onBatchUpdate({ txIds: [row.id], patch: { dateArIso: nextIso } })
  }

  const submitException = async () => {
    await onValidateException(row, exceptionReason)
    setEditingException(false)
    setExceptionReason('')
  }

  return (
    <tr
      onClick={() => onFocusRow(row.id)}
      className={`transition-colors ${isFocused ? 'bg-cyan-950/35' : isChecked ? 'bg-slate-900/90' : 'hover:bg-slate-900/50'}`}
    >
      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Seleccionar ${row.materialName}`}
          checked={isChecked}
          onChange={() => onToggleSelectTx(row.id)}
          className="cursor-pointer accent-cyan-400"
        />
      </td>

      <td
        {...dateCell.domProps}
        onDoubleClick={startDateEdit}
        className={`px-2.5 py-2 whitespace-nowrap font-mono ${dateCell.className}`}
      >
        {editingDate ? (
          <input
            type="date"
            autoFocus
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
            onBlur={() => commitDateEdit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDateEdit()
              if (e.key === 'Escape') setEditingDate(false)
            }}
            className="bg-slate-950 text-slate-100 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px]"
          />
        ) : (
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startDateEdit() }}
              className="inline-flex items-center gap-1 text-slate-200 hover:text-cyan-300 cursor-pointer"
              title="Clic o doble clic para cambiar fecha (salto de quincena)"
            >
              <span><HighlightText text={row.dateAr} query={searchQuery} /></span>
              <Pencil className="w-2.5 h-2.5 opacity-60" />
            </button>
            {row.prevQuincenaMatch && (
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation()
                  onBatchUpdate({ txIds: [row.id], patch: { dateArIso: row.prevQuincenaMatch.lastDateIso } })
                }}
                className="block text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/50 cursor-pointer"
                title={`Coincide en quincena anterior · clic para mover fecha al ${row.prevQuincenaMatch.lastDateAr}`}
              >
                <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                {row.prevQuincenaMatch.lastDateAr}
              </button>
            )}
          </div>
        )}
      </td>

      <td {...voucherCell.domProps} className={`px-2.5 py-2 whitespace-nowrap font-mono text-slate-300 ${voucherCell.className}`}>
        <HighlightText text={row.voucherNumber} query={searchQuery} />
      </td>

      <td {...matCell.domProps} className={`px-2.5 py-2 min-w-[150px] ${matCell.className}`}>
        <div className="font-semibold text-slate-100 leading-snug">
          <HighlightText text={row.materialName} query={searchQuery} />
        </div>
        <div className="text-[10px] font-mono text-slate-400">
          {row.quantity} {row.unitMeasure}
        </div>
      </td>

      <td {...entCell.domProps} className={`px-2.5 py-2 whitespace-nowrap ${entCell.className}`}>
        <div className="font-bold text-amber-200">
          <HighlightText text={row.entity} query={searchQuery} />
        </div>
        {row.workerName && row.workerName.toUpperCase() !== row.entity && (
          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">{row.workerName}</div>
        )}
      </td>

      <td
        {...shipOtCell.domProps}
        onDoubleClick={() => onOpenShipOtModal({ mode: 'single', row })}
        className={`px-2.5 py-2 min-w-[175px] ${shipOtCell.className}`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <div className="font-bold text-cyan-200 text-[11px] truncate">
              <HighlightText text={row.shipName} query={searchQuery} />
            </div>
            <CanonicalOtBadge
              wo={woObj}
              ship={shipObj}
              workItems={workItems}
              workOrders={workOrders}
              variant="inline"
              searchQuery={searchQuery}
            />
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenShipOtModal({ mode: 'single', row }) }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 cursor-pointer shrink-0"
            title="Editar Buque y Orden de Trabajo de esta línea"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      </td>

      <td {...statusCell.domProps} className={`px-2.5 py-2 whitespace-nowrap ${statusCell.className}`}>
        {row.status === 'OK' && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
            title="Material respaldado por horas imputadas en esta quincena"
          >
            <Check className="w-3 h-3" /> OK
          </span>
        )}
        {row.status === 'VALIDATED_EXCEPTION' && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950/90 text-sky-200 border border-sky-500/50"
              title={row.review?.reason || 'Excepción justificada'}
            >
              Excepción ✓
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => { e.stopPropagation(); onRevokeReview(row.reviewKey) }}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
              title="Quitar excepción y volver a revisar"
            >
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        )}
        {row.status === 'NO' && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-500/60"
                title="Sin horas imputadas en la quincena para este Barco, OT y Contratista"
              >
                NO
              </span>
              {row.possibleShipMatches?.length > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/50 text-[10px] font-bold"
                  title={`Misma OT trabajada en: ${row.possibleShipMatches.map((m) => m.shipName).join(', ')}`}
                >
                  <AlertTriangle className="w-2.5 h-2.5" /> {row.possibleShipMatches[0].shipName}
                </span>
              )}
              {row.incompleteData && (
                <span
                  className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-200 border border-amber-500/40 text-[10px]"
                  title="Falta asignar Barco, OT o Contratista"
                >
                  Incompleto
                </span>
              )}
            </div>
            {editingException ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitException()
                    if (e.key === 'Escape') setEditingException(false)
                  }}
                  placeholder="Motivo breve..."
                  className="w-28 bg-slate-950 text-slate-100 border border-sky-500/60 rounded px-1.5 py-0.5 text-[10px]"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={submitException}
                  className="px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 font-black text-[10px] cursor-pointer"
                  title="Confirmar excepción justificada"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation()
                  setExceptionReason('')
                  setEditingException(true)
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-sky-950 text-sky-300 border border-sky-500/40 font-semibold cursor-pointer"
                title="Autorizar este retiro sin carga de horas"
              >
                ✓ Excepción
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
