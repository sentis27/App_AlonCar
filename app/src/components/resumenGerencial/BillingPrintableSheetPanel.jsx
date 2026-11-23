import React, { useMemo, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { isCaldereriaChapter } from '../../lib/billingMirrorEngine'
import {
  PAIRED_GRID_CLASS as PAIRED_GRID,
  SHEET_COLS_CLASS as SHEET_COLS,
  formatMoneyClean,
  annotateBillingPages,
  resolveBlockBillingQty,
  computeA4RemainingSpacerPx
} from '../../lib/billingSheetMath'
import BillingInlineProseCell from './BillingInlineProseCell'
import BillingRightCostCard from './BillingRightCostCard'
import {
  InlineNumberCell,
  InlineQtyCell,
  BillingSheetPageHeader,
  BillingSheetPageFooter
} from './BillingSheetFrameParts'

/**
 * Sábana Blanca Paginada (`HOJA 1/N`) con FILAS SOLDADAS 1-a-1 en la CABECERA (`top-0`)
 * frente a la Tarjeta Compacta de Costos y Alertas al otro lado de la línea roja.
 */
export default function BillingPrintableSheetPanel({
  ship,
  owner,
  budgetNumber = '',
  issueDate = '',
  onChangeBudgetNumber,
  onChangeIssueDate,
  pages = [[]],
  pageSummaries = [],
  otRowMap = new Map(),
  matchedTemplateByWoId = new Map(),
  rubroSubtotalsMap = {},
  onCommitProse,
  onCommitPriceField,
  onToggleTax,
  onChangePricingMode,
  onRequestExpansion,
  onRefreshFromCatalog,
  onRemoveBlock,
  onAddFreeBlock,
  onReorderBlocks,
  printDensity = 'normal',
  registerFlush
}) {
  const isCompact = printDensity === 'compact'
  const [dragBlockId, setDragBlockId] = useState(null)
  const [dragOverBlockId, setDragOverBlockId] = useState(null)

  const annotatedPages = useMemo(() => annotateBillingPages(pages), [pages])

  const handleDrop = (targetBlockId) => {
    if (dragBlockId && targetBlockId && dragBlockId !== targetBlockId) {
      onReorderBlocks?.(dragBlockId, targetBlockId)
    }
    setDragBlockId(null)
    setDragOverBlockId(null)
  }

  return (
    <div className="flex-1 min-w-0 space-y-6">
      {annotatedPages.map((pageEntries, pageIdx) => {
        const summary = pageSummaries[pageIdx] || { pageNumber: pageIdx + 1, totalPages: annotatedPages.length, exentoUsd: 0, gravadoUsd: 0, ivaUsd: 0, totalUsd: 0 }
        const isLastPage = pageIdx === annotatedPages.length - 1
        const remainingA4Px = computeA4RemainingSpacerPx(pages[pageIdx], pageIdx, { density: printDensity })

        return (
          <div key={`page_${pageIdx}`} className="space-y-0">
            <BillingSheetPageHeader
              ship={ship}
              owner={owner}
              budgetNumber={budgetNumber}
              issueDate={issueDate}
              onChangeBudgetNumber={onChangeBudgetNumber}
              onChangeIssueDate={onChangeIssueDate}
              summary={summary}
              pageIdx={pageIdx}
            />

            {pageEntries.map(({ block, isDelimiter, itemIndex, activeRubroLabel }) => {
              const otRow = block.workOrderId ? otRowMap.get(block.workOrderId) : null
              const matchedTpl = block.workOrderId ? matchedTemplateByWoId.get(block.workOrderId) || null : null
              const isCaldereria = isCaldereriaChapter(activeRubroLabel || block.billing_rubro_group)
              const pricingMode = block.billing_pricing_mode || 'MO_MAT'
              const qtyDisplay = resolveBlockBillingQty(block, { isCaldereria, weightKg: otRow?.weightKg || 0 })
              const unitLineTotal = pricingMode === 'UNITARIO'
                ? Number(((Number(qtyDisplay) || 0) * (Number(block.billing_unit_price_usd) || 0)).toFixed(2))
                : 0

              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => setDragBlockId(block.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverBlockId(block.id) }}
                  onDrop={() => handleDrop(block.id)}
                  className={`${PAIRED_GRID} ${dragOverBlockId === block.id ? 'ring-2 ring-sky-400 rounded' : ''}`}
                >
                  {isDelimiter ? (
                    <div className="grid grid-cols-[20px_minmax(0,1fr)_40px] bg-slate-200 border-x border-b border-slate-500 items-center text-slate-950">
                      <div className="flex items-center justify-center py-1.5 text-slate-500 cursor-grab active:cursor-grabbing"><GripVertical className="w-3.5 h-3.5" /></div>
                      <div className="px-2 py-1 flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wide">{block.label}</span>
                        {isCaldereria && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[9px] font-bold">KG activos en CANT.</span>}
                      </div>
                      <div className="bg-rose-50/70 h-full" />
                    </div>
                  ) : (
                    <div className={`${SHEET_COLS} bg-white text-slate-950 border-x border-slate-400 border-b border-b-slate-300 items-stretch ${isCompact ? 'min-h-[36px]' : 'min-h-[44px]'}`}>
                      <div className={`flex items-start justify-center ${isCompact ? 'pt-1' : 'pt-1.5'} text-slate-400 hover:text-slate-800 border-r border-slate-200 cursor-grab active:cursor-grabbing`} title="Arrastrar para reordenar bloque + venta + costos">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <div className={`${isCompact ? 'pt-1' : 'pt-1.5'} text-center text-[11px] font-mono text-slate-600 border-r border-slate-300`}>{itemIndex}</div>
                      <div className={`${isCompact ? 'pt-0.5' : 'pt-1'} px-1 border-r border-slate-300`}>
                        <InlineQtyCell value={qtyDisplay} isKgMode={pricingMode !== 'UNITARIO' && isCaldereria} onCommit={(v) => onCommitPriceField?.(block, 'billing_qty_override', v)} />
                      </div>
                      <div className={`px-2 ${isCompact ? 'py-0.5' : 'py-1'} border-r border-slate-300 flex flex-col justify-between`}>
                        <BillingInlineProseCell blockId={block.id} shipId={ship?.id} htmlValue={block.billing_description || ''} fontSizePx={block.fontSizePx || 12} compact={isCompact} autoFocus={Boolean(block.autoFocus)} onCommit={onCommitProse} registerFlush={registerFlush} />
                        {pricingMode === 'MO_MAT' && (
                          <div className={`flex flex-col items-end text-[10px] font-black text-slate-700 ${isCompact ? 'leading-4 pt-0.5' : 'leading-5 pt-1'} select-none`}>
                            <span>MAT</span>
                            <span>M.O.</span>
                          </div>
                        )}
                      </div>
                      <div className="px-1 py-1 border-r border-slate-300 flex flex-col justify-end text-[11px]">
                        {pricingMode === 'UNITARIO' ? (
                          <InlineNumberCell value={block.billing_unit_price_usd} placeholder="Unit." onCommit={(v) => onCommitPriceField?.(block, 'billing_unit_price_usd', v)} />
                        ) : pricingMode === 'SIN_CARGO' ? (
                          <span className="text-center text-[10px] font-bold text-slate-600 pb-1">sin cargo</span>
                        ) : null}
                      </div>
                      <div className="px-1 py-1 border-r border-slate-300 flex flex-col justify-end text-[11px] font-bold">
                        {pricingMode === 'MO_MAT' ? (
                          <div className="space-y-0.5">
                            <InlineNumberCell value={block.billing_mat_usd} placeholder="MAT $" onCommit={(v) => onCommitPriceField?.(block, 'billing_mat_usd', v)} />
                            <InlineNumberCell value={block.billing_mo_usd} placeholder="M.O. $" onCommit={(v) => onCommitPriceField?.(block, 'billing_mo_usd', v)} />
                          </div>
                        ) : pricingMode === 'UNITARIO' ? (
                          <div className="text-right tabular-nums px-1 py-0.5 text-slate-950">{formatMoneyClean(unitLineTotal)}</div>
                        ) : <div className="text-center text-[10px] text-slate-500 pb-1">—</div>}
                      </div>
                      <div className="bg-rose-50/90 px-0.5 py-1 flex flex-col justify-end items-center gap-0.5">
                        {pricingMode === 'MO_MAT' ? (
                          <>
                            <button type="button" onClick={() => onToggleTax?.(block, 'billing_mat_tax')} className={`w-full py-0.5 rounded text-[9px] font-black cursor-pointer ${block.billing_mat_tax === 'GRAVADO_21' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`} title="Alternar IVA 21% / Exento en MAT">
                              {block.billing_mat_tax === 'GRAVADO_21' ? '21%' : 'EX'}
                            </button>
                            <button type="button" onClick={() => onToggleTax?.(block, 'billing_mo_tax')} className={`w-full py-0.5 rounded text-[9px] font-black cursor-pointer ${block.billing_mo_tax === 'GRAVADO_21' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`} title="Alternar IVA 21% / Exento en M.O.">
                              {block.billing_mo_tax === 'GRAVADO_21' ? '21%' : 'EX'}
                            </button>
                          </>
                        ) : pricingMode === 'UNITARIO' ? (
                          <button type="button" onClick={() => onToggleTax?.(block, 'billing_mo_tax')} className={`w-full py-0.5 rounded text-[9px] font-black cursor-pointer ${block.billing_mo_tax === 'GRAVADO_21' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                            {block.billing_mo_tax === 'GRAVADO_21' ? '21%' : 'EX'}
                          </button>
                        ) : <span className="text-[9px] text-slate-400">—</span>}
                      </div>
                    </div>
                  )}

                  <div className="hidden xl:block bg-rose-600" />

                  <div className="self-start py-1">
                    <BillingRightCostCard
                      block={block}
                      otRow={otRow}
                      matchedTemplate={matchedTpl}
                      rubroSubtotal={isDelimiter ? rubroSubtotalsMap[block.label] : null}
                      onRequestExpansion={onRequestExpansion}
                      onRefreshFromCatalog={onRefreshFromCatalog}
                      onChangePricingMode={onChangePricingMode}
                      onRemoveBlock={onRemoveBlock}
                    />
                  </div>
                </div>
              )
            })}

            {remainingA4Px > 24 && (
              <div className={PAIRED_GRID}>
                <div style={{ minHeight: `${remainingA4Px}px` }} className={`${SHEET_COLS} bg-white border-x border-slate-400 select-none`}>
                  <div className="border-r border-slate-200" />
                  <div className="border-r border-slate-300" />
                  <div className="border-r border-slate-300" />
                  <div className="border-r border-slate-300" />
                  <div className="border-r border-slate-300" />
                  <div className="border-r border-slate-300" />
                  <div className="bg-rose-50/40" />
                </div>
                <div className="hidden xl:block bg-rose-600" />
                <div />
              </div>
            )}

            <BillingSheetPageFooter summary={summary} isLastPage={isLastPage} onAddFreeBlock={onAddFreeBlock} />
          </div>
        )
      })}
    </div>
  )
}
