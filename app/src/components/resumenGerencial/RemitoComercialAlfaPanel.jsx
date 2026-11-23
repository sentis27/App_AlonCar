import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Ship } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { computeShipManagerialSummary } from '../../lib/managerialSummaryService'
import { evaluateShipWorkOrdersForGhostImport, matchOtToAbcTemplate } from '../../lib/billingMirrorEngine'
import { computeBlockBillingBreakdown, paginateBillingBlocks, computePaginatedCumulativeBalances, computeA4AutoFitPlan } from '../../lib/billingSheetMath'
import { buildOrderedBillingBlocks, isWorkOrderExcludedFromBilling } from '../../lib/billingWorkflowService'
import { openCleanBillingPrintWindow } from '../../lib/billingPrintHelper'
import { getTodayIsoDate } from '../../lib/aloncarLogoSvg'
import { useBillingWorkspaceHandlers } from '../../hooks/useBillingWorkspaceHandlers'
import BillingShipSidebarRail from './BillingShipSidebarRail'
import BillingWorkspaceToolbar from './BillingWorkspaceToolbar'
import BillingPrintableSheetPanel from './BillingPrintableSheetPanel'

const BILLING_ACTIVE_SHIP_KEY = 'aloncar_independent_billing_ship_id'

/** Mesa Independiente Multi-Barco de Pre-Facturación en 3 Columnas (V4). */
export default function RemitoComercialAlfaPanel({
  allShips = [], owners = [], workOrders = [], workItems = [], materialRows = [],
  laborRows = [], thirdPartyRows = [], workers = [], otTemplates = [],
  jumpToShipTarget = null, onReloadData, showFeedback
}) {
  const { user, profile } = useAuth()
  const actorName = profile?.full_name || user?.email || 'Gerencia'

  const [billingShipState, setBillingShipState] = useState(() => {
    try { return { shipId: window.localStorage.getItem(BILLING_ACTIVE_SHIP_KEY) || '', handledJumpTs: 0 } }
    catch { return { shipId: '', handledJumpTs: 0 } }
  })
  const billingShipId = jumpToShipTarget?.shipId && jumpToShipTarget.ts > billingShipState.handledJumpTs
    ? jumpToShipTarget.shipId
    : billingShipState.shipId
  const setBillingShipId = (nextId) => setBillingShipState({ shipId: nextId, handledJumpTs: jumpToShipTarget?.ts || Date.now() })
  const [newBlockAutoFocusId, setNewBlockAutoFocusId] = useState(null)

  const activeFlushRef = useRef(null)
  const registerFlush = (fn) => {
    activeFlushRef.current = fn
    return () => { if (activeFlushRef.current === fn) activeFlushRef.current = null }
  }

  useEffect(() => {
    try { if (billingShipId) window.localStorage.setItem(BILLING_ACTIVE_SHIP_KEY, billingShipId) } catch { /* ignore */ }
  }, [billingShipId])

  const inPrepShips = useMemo(
    () => (allShips || []).filter((s) => s.billing_workspace_status === 'EN_PREPARACION' && String(s.name || '').toUpperCase() !== 'ASTILLERO'),
    [allShips]
  )

  const effectiveShipId = useMemo(() => {
    if (billingShipId && (allShips || []).some((s) => s.id === billingShipId && s.billing_workspace_status !== 'NONE')) return billingShipId
    return inPrepShips[0]?.id || ''
  }, [billingShipId, allShips, inPrepShips])

  const activeShip = useMemo(() => (allShips || []).find((s) => s.id === effectiveShipId) || null, [allShips, effectiveShipId])
  const activeOwner = useMemo(() => (owners || []).find((o) => o.id === activeShip?.owner_id) || null, [owners, activeShip])
  const activeIssueDate = activeShip?.billing_layout_meta?.issueDate || getTodayIsoDate()

  const billingShipSummary = useMemo(() => {
    if (!activeShip) return null
    return computeShipManagerialSummary({
      shipId: activeShip.id, ships: allShips, workOrders, workItems, materialRows, laborRows, thirdPartyRows, scope: 'mixto', yearFilter: 'TODOS'
    })
  }, [activeShip, allShips, workOrders, workItems, materialRows, laborRows, thirdPartyRows])

  const otRowMap = useMemo(() => {
    const m = new Map()
    ;(billingShipSummary?.otRows || []).forEach((r) => m.set(r.id, r))
    return m
  }, [billingShipSummary])

  const activeShipWos = useMemo(
    () => (activeShip ? workOrders.filter((w) => w.ship_id === activeShip.id && !w.merged_into_wo_id) : []),
    [activeShip, workOrders]
  )

  const matchedTemplateByWoId = useMemo(() => {
    const map = new Map()
    for (const wo of activeShipWos) {
      const tpl = matchOtToAbcTemplate(wo, otTemplates)
      if (tpl) map.set(wo.id, tpl)
    }
    return map
  }, [activeShipWos, otTemplates])

  const ghostEval = useMemo(() => evaluateShipWorkOrdersForGhostImport({
    shipWos: activeShipWos, workItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates,
    existingCustomBlocks: activeShip?.billing_layout_meta?.customBlocks || []
  }), [activeShip, activeShipWos, workItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates])

  const orderedBlocks = useMemo(
    () => buildOrderedBillingBlocks({ activeShip, activeShipWos, workItems, newBlockAutoFocusId }),
    [activeShip, activeShipWos, workItems, newBlockAutoFocusId]
  )

  const rubroSubtotalsMap = useMemo(() => {
    const map = {}
    let currentLabel = ''
    for (const b of orderedBlocks) {
      if (b.blockType === 'RUBRO_DELIMITER') {
        currentLabel = b.label || ''
        if (!map[currentLabel]) map[currentLabel] = { costUsd: 0, weightKg: 0 }
      } else if (currentLabel && b.workOrderId) {
        const ot = otRowMap.get(b.workOrderId)
        if (ot) {
          map[currentLabel].costUsd += Number(ot.directTotalUsd) || 0
          map[currentLabel].weightKg += Number(ot.weightKg) || 0
        }
      }
    }
    return map
  }, [orderedBlocks, otRowMap])

  const printDensity = activeShip?.billing_layout_meta?.printDensity === 'compact' ? 'compact' : 'normal'
  const pages = useMemo(() => paginateBillingBlocks(orderedBlocks, null, { density: printDensity }), [orderedBlocks, printDensity])
  const autoFitPreview = useMemo(() => computeA4AutoFitPlan(orderedBlocks, printDensity), [orderedBlocks, printDensity])
  const { pageSummaries, grandTotal } = useMemo(() => computePaginatedCumulativeBalances(pages, billingShipSummary?.totals?.directTotalUsd || 0), [pages, billingShipSummary])

  const shipCardMetaMap = useMemo(() => {
    const map = {}
    for (const s of allShips || []) {
      if (s.billing_workspace_status === 'NONE') continue
      const sWos = workOrders.filter((w) => w.ship_id === s.id && w.is_in_billing && !isWorkOrderExcludedFromBilling(w, workItems))
      let totalUsd = 0
      for (const w of sWos) totalUsd += computeBlockBillingBreakdown(w).totalUsd
      const custom = Array.isArray(s.billing_layout_meta?.customBlocks) ? s.billing_layout_meta.customBlocks : []
      for (const c of custom) if (c.blockType === 'FREE_BLOCK') totalUsd += computeBlockBillingBreakdown(c).totalUsd
      const hasReq = workOrders.some((w) => w.ship_id === s.id && w.foreman_review_status === 'REQUESTED')
      map[s.id] = { totalUsd, otCount: sWos.length, hasAlerts: hasReq }
    }
    return map
  }, [allShips, workOrders, workItems])

  const h = useBillingWorkspaceHandlers({
    allShips, activeShip, activeOwner, activeShipWos, workOrders, workItems, laborRows, materialRows,
    thirdPartyRows, workers, otTemplates, matchedTemplateByWoId, inPrepShips, effectiveShipId,
    orderedBlocks, pages, pageSummaries, grandTotal, otRowMap, ghostEval, printDensity, autoFitPreview,
    activeIssueDate, actorName, activeFlushRef, setBillingShipId, setNewBlockAutoFocusId, onReloadData, showFeedback
  })

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-start">
      <BillingShipSidebarRail
        ships={allShips}
        activeShipId={effectiveShipId}
        shipCardMetaMap={shipCardMetaMap}
        onSelectShip={h.handleSwitchShip}
        onAddShipToWorkspace={h.handleAddShipToWorkspace}
        onReopenShipFromSent={h.handleAddShipToWorkspace}
        onSetShipColor={h.handleSetShipColor}
        onRemoveShipFromWorkspace={h.handleRemoveShipFromWorkspace}
      />

      <div className="flex-1 min-w-0 space-y-3 w-full">
        {!activeShip ? (
          <div className="bg-slate-900/70 border border-dashed border-slate-700 rounded-2xl p-12 text-center space-y-2">
            <Ship className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-black text-white">Mesa Independiente Multi-Barco de Facturación</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tocá <strong>&quot;+ Sumar&quot;</strong> en el menú izquierdo para abrir la sábana blanca de un barco (o usá el botón <strong>Facturar</strong> en cualquier OT de RESUMEN 2).
            </p>
          </div>
        ) : (
          <>
            <BillingWorkspaceToolbar
              shipName={activeShip.name}
              grandTotal={grandTotal}
              readyToImportCount={ghostEval.readyToImport.length}
              emptyDescriptionAlerts={ghostEval.emptyDescriptionAlerts}
              orphanSummary={billingShipSummary?.orphanSummary}
              importing={h.importing}
              refreshingCosts={h.refreshingCosts}
              sendingToBilling={h.sendingShip}
              autoFitting={h.autoFitting}
              printDensity={printDensity}
              autoFitPreview={autoFitPreview}
              isSentMode={activeShip.billing_workspace_status === 'ENVIADO_A_FACTURACION'}
              onImportAll={h.handleImportAll}
              onRefreshCosts={h.handleRefreshCosts}
              onNotifyEmptyOts={h.handleNotifyEmptyOts}
              onAddRubroDelimiter={h.handleAddRubroDelimiter}
              onAddFreeBlock={h.handleAddFreeBlock}
              onAutoFitA4={h.handleAutoFitA4}
              onPrintCleanPdf={() => openCleanBillingPrintWindow({
                ship: activeShip, owner: activeOwner, budgetNumber: activeShip.billing_budget_number || '',
                issueDate: activeIssueDate, pages, pageSummaries, otRowMap, printDensity
              })}
              onSendShipToFinalBilling={h.handleSendShipToFinalBilling}
            />

            <BillingPrintableSheetPanel
              ship={activeShip}
              owner={activeOwner}
              budgetNumber={activeShip.billing_budget_number || ''}
              issueDate={activeIssueDate}
              onChangeBudgetNumber={(val) => h.saveLayoutMeta(activeShip.billing_layout_meta || {}, val)}
              onChangeIssueDate={h.handleChangeIssueDate}
              pages={pages}
              pageSummaries={pageSummaries}
              otRowMap={otRowMap}
              matchedTemplateByWoId={matchedTemplateByWoId}
              rubroSubtotalsMap={rubroSubtotalsMap}
              onCommitProse={h.handleCommitProse}
              onCommitPriceField={h.handleCommitPriceField}
              onCommitLineItems={h.handleCommitLineItems}
              onCommitHeading={h.handleCommitHeading}
              onToggleTax={h.handleToggleTax}
              onChangePricingMode={h.handleChangePricingMode}
              onRequestExpansion={h.handleRequestExpansion}
              onRefreshFromCatalog={h.handleRefreshFromCatalog}
              onRemoveBlock={h.handleRemoveBlock}
              onAddFreeBlock={h.handleAddFreeBlock}
              onReorderBlocks={h.handleReorderBlocks}
              printDensity={printDensity}
              registerFlush={registerFlush}
            />
          </>
        )}
      </div>
    </div>
  )
}
