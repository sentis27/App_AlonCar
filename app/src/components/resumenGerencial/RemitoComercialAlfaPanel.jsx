import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Ship } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { computeShipManagerialSummary } from '../../lib/managerialSummaryService'
import { evaluateShipWorkOrdersForGhostImport, isCaldereriaChapter, matchOtToAbcTemplate, buildCatalogBillingProse } from '../../lib/billingMirrorEngine'
import { computeBlockBillingBreakdown, paginateBillingBlocks, computePaginatedCumulativeBalances, computeA4AutoFitPlan, buildAutoFitLayoutMetaPatch } from '../../lib/billingSheetMath'
import { openShipInBillingWorkspaceService, sendShipToFinalBillingService, saveShipBillingLayoutMetaService, importShipWorkOrdersGhostService, saveWorkOrderBillingPatchService, saveWorkOrderBillingOrderBatchService, requestBillingExpansionService, buildOrderedBillingBlocks } from '../../lib/billingWorkflowService'
import { openCleanBillingPrintWindow } from '../../lib/billingPrintHelper'
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
  const [importing, setImporting] = useState(false)
  const [sendingShip, setSendingShip] = useState(false)
  const [autoFitting, setAutoFitting] = useState(false)
  const [newBlockAutoFocusId, setNewBlockAutoFocusId] = useState(null)

  const activeFlushRef = useRef(null)
  const registerFlush = (fn) => {
    activeFlushRef.current = fn
    return () => { if (activeFlushRef.current === fn) activeFlushRef.current = null }
  }

  // Persistir el barco activo de la Mesa Independiente (nunca alterado por Resumen Gerencial)
  useEffect(() => {
    try {
      if (billingShipId) window.localStorage.setItem(BILLING_ACTIVE_SHIP_KEY, billingShipId)
    } catch { /* ignore */ }
  }, [billingShipId])

  const inPrepShips = useMemo(
    () => (allShips || []).filter((s) => s.billing_workspace_status === 'EN_PREPARACION' && String(s.name || '').toUpperCase() !== 'ASTILLERO'),
    [allShips]
  )

  const effectiveShipId = useMemo(() => {
    if (billingShipId && (allShips || []).some((s) => s.id === billingShipId && s.billing_workspace_status !== 'NONE')) {
      return billingShipId
    }
    return inPrepShips[0]?.id || ''
  }, [billingShipId, allShips, inPrepShips])

  const activeShip = useMemo(() => (allShips || []).find((s) => s.id === effectiveShipId) || null, [allShips, effectiveShipId])
  const activeOwner = useMemo(() => (owners || []).find((o) => o.id === activeShip?.owner_id) || null, [owners, activeShip])

  // Resumen financiero en VIVO exclusivo del barco activo en Facturación (independiente del Resumen Gerencial)
  const billingShipSummary = useMemo(() => {
    if (!activeShip) return null
    return computeShipManagerialSummary({
      shipId: activeShip.id,
      ships: allShips,
      workOrders,
      workItems,
      materialRows,
      laborRows,
      thirdPartyRows,
      scope: 'mixto',
      yearFilter: 'TODOS'
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

  // Evaluación SIN IA para Importar Todo + Alertas de OTs con descripción vacía
  const ghostEval = useMemo(() => evaluateShipWorkOrdersForGhostImport({
    shipWos: activeShipWos,
    workItems,
    laborRows,
    materialRows,
    thirdPartyRows,
    workers,
    otTemplates
  }), [activeShipWos, workItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates])

  // Construir lista ordenada unificada: OTs en billing + delimitadores/bloques libres en `ships.billing_layout_meta`
  const orderedBlocks = useMemo(
    () => buildOrderedBillingBlocks({ activeShip, activeShipWos, newBlockAutoFocusId }),
    [activeShip, activeShipWos, newBlockAutoFocusId]
  )

  // Subtotales por rubro para mostrar frente a cada Delimitador de Rubro
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

  // Metadata resumida para las tarjetas del Menú Lateral Izquierdo
  const shipCardMetaMap = useMemo(() => {
    const map = {}
    for (const s of allShips || []) {
      if (s.billing_workspace_status === 'NONE') continue
      const sWos = workOrders.filter((w) => w.ship_id === s.id && w.is_in_billing)
      let totalUsd = 0
      for (const w of sWos) totalUsd += computeBlockBillingBreakdown(w).totalUsd
      const custom = Array.isArray(s.billing_layout_meta?.customBlocks) ? s.billing_layout_meta.customBlocks : []
      for (const c of custom) if (c.blockType === 'FREE_BLOCK') totalUsd += computeBlockBillingBreakdown(c).totalUsd
      const hasReq = workOrders.some((w) => w.ship_id === s.id && w.foreman_review_status === 'REQUESTED')
      map[s.id] = { totalUsd, otCount: sWos.length, hasAlerts: hasReq }
    }
    return map
  }, [allShips, workOrders])

  const handleSwitchShip = (nextShipId) => {
    activeFlushRef.current?.()
    setNewBlockAutoFocusId(null)
    setBillingShipId(nextShipId)
  }

  const handleAddShipToWorkspace = async (ship) => {
    try {
      activeFlushRef.current?.()
      await openShipInBillingWorkspaceService({ ship, user: actorName })
      setBillingShipId(ship.id)
      await onReloadData?.()
      showFeedback?.('success', `Barco ${ship.name} abierto en tu Mesa de Facturación.`)
    } catch (err) {
      showFeedback?.('error', err.message)
    }
  }

  const handleImportAll = async () => {
    if (!activeShip) return
    if (ghostEval.readyToImport.length === 0) {
      showFeedback?.('success', 'No hay nuevas OTs con descripción cargada pendientes de importar.')
      return
    }
    try {
      setImporting(true)
      const { importedCount } = await importShipWorkOrdersGhostService({
        ship: activeShip,
        readyToImport: ghostEval.readyToImport,
        user: actorName
      })
      await onReloadData?.()
      showFeedback?.('success', `${importedCount} OT(s) importadas en modo fantasma y ordenadas automáticamente.`)
    } catch (err) {
      showFeedback?.('error', err.message)
    } finally {
      setImporting(false)
    }
  }

  const handleNotifyEmptyOts = async () => {
    if (!activeShip) return
    try {
      for (const al of ghostEval.emptyDescriptionAlerts) {
        const wo = activeShipWos.find((w) => w.id === al.workOrderId)
        if (wo) {
          await requestBillingExpansionService({
            wo,
            ship: activeShip,
            note: 'OT detectada con descripción vacía al intentar importar a Facturación.',
            user: actorName
          })
        }
      }
      await onReloadData?.()
      showFeedback?.('success', `Se notificó al Jefe de Obra y Administrador por ${ghostEval.emptyDescriptionAlerts.length} OT(s) sin descripción.`)
    } catch (err) {
      showFeedback?.('error', err.message)
    }
  }

  const saveLayoutMeta = async (nextMeta, nextBudget) => {
    if (!activeShip) return
    await saveShipBillingLayoutMetaService({
      shipId: activeShip.id,
      shipName: activeShip.name,
      layoutMeta: nextMeta,
      budgetNumber: nextBudget,
      user: actorName
    })
    await onReloadData?.()
  }

  const handleAddRubroDelimiter = async (code, label) => {
    if (!activeShip) return
    const meta = activeShip.billing_layout_meta || {}
    const existing = Array.isArray(meta.customBlocks) ? meta.customBlocks : []
    const maxSort = orderedBlocks.reduce((m, b) => Math.max(m, b.sortOrder || 0), 0)
    const nextBlock = { id: `delim_${Date.now()}`, blockType: 'RUBRO_DELIMITER', code, label, sortOrder: maxSort + 10 }
    await saveLayoutMeta({ ...meta, customBlocks: [...existing, nextBlock] })
  }

  const handleAddFreeBlock = async () => {
    if (!activeShip) return
    const meta = activeShip.billing_layout_meta || {}
    const existing = Array.isArray(meta.customBlocks) ? meta.customBlocks : []
    const maxSort = orderedBlocks.reduce((m, b) => Math.max(m, b.sortOrder || 0), 0)
    const id = `free_${Date.now()}`
    const nextBlock = {
      id, blockType: 'FREE_BLOCK', sortOrder: maxSort + 10, billing_description: '',
      billing_pricing_mode: 'MO_MAT', billing_mo_usd: 0, billing_mat_usd: 0,
      billing_unit_price_usd: 0, billing_qty_override: null, billing_mo_tax: 'EXENTO', billing_mat_tax: 'EXENTO', fontSizePx: 12
    }
    setNewBlockAutoFocusId(id)
    await saveLayoutMeta({ ...meta, customBlocks: [...existing, nextBlock] })
  }

  const handleCommitProse = async ({ shipId, blockId, nextHtml, fontSizePx }) => {
    const targetShip = (allShips || []).find((s) => s.id === shipId) || activeShip
    if (!targetShip) return
    if (String(blockId).startsWith('wo_')) {
      const woId = blockId.slice(3)
      const wo = workOrders.find((w) => w.id === woId)
      await saveWorkOrderBillingPatchService({
        woId, shipName: targetShip.name, otLabel: `${wo?.ot_number || 'OT'} ${wo?.title || ''}`,
        patch: { billing_description: nextHtml }, field: 'billing_description',
        oldValue: wo?.billing_description || '', newValue: nextHtml, user: actorName
      })
      const meta = targetShip.billing_layout_meta || {}
      if (fontSizePx && meta.fontSizes?.[woId] !== fontSizePx) {
        await saveShipBillingLayoutMetaService({
          shipId: targetShip.id, shipName: targetShip.name,
          layoutMeta: { ...meta, fontSizes: { ...(meta.fontSizes || {}), [woId]: fontSizePx } }, user: actorName
        })
      }
      await onReloadData?.()
    } else {
      const meta = targetShip.billing_layout_meta || {}
      const custom = (meta.customBlocks || []).map((b) => (b.id === blockId ? { ...b, billing_description: nextHtml, fontSizePx } : b))
      await saveShipBillingLayoutMetaService({ shipId: targetShip.id, shipName: targetShip.name, layoutMeta: { ...meta, customBlocks: custom }, user: actorName })
      await onReloadData?.()
    }
  }

  const handleCommitPriceField = async (block, field, val) => {
    if (!activeShip) return
    if (block.workOrderId) {
      await saveWorkOrderBillingPatchService({
        woId: block.workOrderId, shipName: activeShip.name, otLabel: block.id,
        patch: { [field]: val }, field, oldValue: block[field], newValue: val, user: actorName
      })
      await onReloadData?.()
    } else {
      const meta = activeShip.billing_layout_meta || {}
      const custom = (meta.customBlocks || []).map((b) => (b.id === block.id ? { ...b, [field]: val } : b))
      await saveLayoutMeta({ ...meta, customBlocks: custom })
    }
  }

  const handleRefreshFromCatalog = async (block, matchedTpl) => {
    if (!activeShip || !block?.workOrderId || !matchedTpl) return
    const wo = activeShipWos.find((w) => w.id === block.workOrderId)
    const nextProse = buildCatalogBillingProse(matchedTpl, wo?.title)
    if (!nextProse || !window.confirm(`¿Reemplazar el texto actual de "${wo?.title || matchedTpl.name}" por la descripción de facturación oficial del Catálogo OT.ABC?`)) return
    await saveWorkOrderBillingPatchService({
      woId: block.workOrderId, shipName: activeShip.name, otLabel: `${wo?.ot_number || 'OT'} ${wo?.title || matchedTpl.name}`,
      patch: { billing_description: nextProse }, field: 'billing_description', oldValue: block.billing_description || '', newValue: nextProse, user: actorName
    })
    await onReloadData?.()
    showFeedback?.('success', `Descripción de facturación actualizada desde Catálogo OT.ABC (${matchedTpl.name}).`)
  }

  const handleToggleTax = (block, taxField) => {
    const nextVal = block[taxField] === 'GRAVADO_21' ? 'EXENTO' : 'GRAVADO_21'
    handleCommitPriceField(block, taxField, nextVal)
  }

  const handleChangePricingMode = (block, mode) => handleCommitPriceField(block, 'billing_pricing_mode', mode)

  const handleRemoveBlock = async (block) => {
    if (!activeShip) return
    if (block.workOrderId) {
      await saveWorkOrderBillingPatchService({
        woId: block.workOrderId, shipName: activeShip.name, otLabel: block.id,
        patch: { is_in_billing: false }, field: 'is_in_billing', oldValue: true, newValue: false, user: actorName
      })
      await onReloadData?.()
    } else {
      const meta = activeShip.billing_layout_meta || {}
      await saveLayoutMeta({ ...meta, customBlocks: (meta.customBlocks || []).filter((b) => b.id !== block.id) })
    }
  }

  const handleReorderBlocks = async (dragId, targetId) => {
    if (!activeShip) return
    const list = [...orderedBlocks]
    const fromIdx = list.findIndex((b) => b.id === dragId)
    const toIdx = list.findIndex((b) => b.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)

    let currentRubro = ''
    const woUpdates = []
    const nextCustom = []
    list.forEach((b, idx) => {
      const nextSort = (idx + 1) * 10
      if (b.blockType === 'RUBRO_DELIMITER') {
        currentRubro = b.code || b.label || ''
        nextCustom.push({ ...b, sortOrder: nextSort })
      } else if (b.workOrderId) {
        const nextRubro = currentRubro || b.billing_rubro_group || (isCaldereriaChapter(currentRubro) ? 'CALDERERIA' : '')
        woUpdates.push({ id: b.workOrderId, patch: { billing_sort_order: nextSort, ...(currentRubro ? { billing_rubro_group: nextRubro } : {}) } })
      } else {
        nextCustom.push({ ...b, sortOrder: nextSort })
      }
    })

    await saveWorkOrderBillingOrderBatchService({ updates: woUpdates, shipName: activeShip.name, user: actorName })
    await saveLayoutMeta({ ...(activeShip.billing_layout_meta || {}), customBlocks: nextCustom })
  }

  const handleAutoFitA4 = async () => {
    if (!activeShip) return
    try {
      setAutoFitting(true)
      activeFlushRef.current?.()
      const { nextMeta, feedbackMessage } = buildAutoFitLayoutMetaPatch({ meta: activeShip.billing_layout_meta || {}, orderedBlocks, printDensity, autoFitPreview })
      await saveLayoutMeta(nextMeta)
      showFeedback?.('success', feedbackMessage)
    } catch (err) {
      showFeedback?.('error', err.message)
    } finally {
      setAutoFitting(false)
    }
  }

  const handleSendShipToFinalBilling = async () => {
    if (!activeShip) return
    if (!window.confirm(`¿Enviar "${activeShip.name}" a la bandeja de Listos para Facturar con saldo ${grandTotal.totalUsd.toFixed(2)} USD? Desaparecerá de tu lista activa.`)) return
    try {
      setSendingShip(true)
      activeFlushRef.current?.()
      await sendShipToFinalBillingService({
        ship: activeShip,
        totalSnapshotUsd: grandTotal.totalUsd,
        budgetNumber: activeShip.billing_budget_number || '',
        user: actorName
      })
      const nextActive = inPrepShips.find((s) => s.id !== activeShip.id)
      setBillingShipId(nextActive?.id || '')
      await onReloadData?.()
      showFeedback?.('success', `${activeShip.name} enviado a Facturación / Listos para Cobrar.`)
    } catch (err) {
      showFeedback?.('error', err.message)
    } finally {
      setSendingShip(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-start">
      {/* COLUMNA 1: Menú Lateral Multi-Barco Independiente */}
      <BillingShipSidebarRail
        ships={allShips}
        activeShipId={effectiveShipId}
        shipCardMetaMap={shipCardMetaMap}
        onSelectShip={handleSwitchShip}
        onAddShipToWorkspace={handleAddShipToWorkspace}
        onReopenShipFromSent={handleAddShipToWorkspace}
      />

      {/* COLUMNAS 2 y 3: Sábana Blanca Paginada + Costos Compactos Soldados en Cabecera */}
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
              readyToImportCount={ghostEval.readyToImport.length}
              emptyDescriptionAlerts={ghostEval.emptyDescriptionAlerts}
              orphanSummary={billingShipSummary?.orphanSummary}
              importing={importing}
              sendingToBilling={sendingShip}
              autoFitting={autoFitting}
              printDensity={printDensity}
              autoFitPreview={autoFitPreview}
              isSentMode={activeShip.billing_workspace_status === 'ENVIADO_A_FACTURACION'}
              onImportAll={handleImportAll}
              onNotifyEmptyOts={handleNotifyEmptyOts}
              onAddRubroDelimiter={handleAddRubroDelimiter}
              onAddFreeBlock={handleAddFreeBlock}
              onAutoFitA4={handleAutoFitA4}
              onPrintCleanPdf={() => openCleanBillingPrintWindow({
                ship: activeShip, owner: activeOwner, budgetNumber: activeShip.billing_budget_number || '',
                pages, pageSummaries, otRowMap, printDensity
              })}
              onSendShipToFinalBilling={handleSendShipToFinalBilling}
            />

            <BillingPrintableSheetPanel
              ship={activeShip}
              owner={activeOwner}
              budgetNumber={activeShip.billing_budget_number || ''}
              onChangeBudgetNumber={(val) => saveLayoutMeta(activeShip.billing_layout_meta || {}, val)}
              pages={pages}
              pageSummaries={pageSummaries}
              grandTotal={grandTotal}
              otRowMap={otRowMap}
              matchedTemplateByWoId={matchedTemplateByWoId}
              rubroSubtotalsMap={rubroSubtotalsMap}
              onCommitProse={handleCommitProse}
              onCommitPriceField={handleCommitPriceField}
              onToggleTax={handleToggleTax}
              onChangePricingMode={handleChangePricingMode}
              onRequestExpansion={async (otRow, note) => {
                const wo = activeShipWos.find((w) => w.id === otRow.id)
                if (!wo) return
                await requestBillingExpansionService({ wo, ship: activeShip, note, user: actorName })
                await onReloadData?.()
                showFeedback?.('success', `Acuse de ampliación enviado a ${otRow.foremanName || 'Jefe de Obra'} + Administrador.`)
              }}
              onRefreshFromCatalog={handleRefreshFromCatalog}
              onRemoveBlock={handleRemoveBlock}
              onAddFreeBlock={handleAddFreeBlock}
              onReorderBlocks={handleReorderBlocks}
              printDensity={printDensity}
              registerFlush={registerFlush}
            />
          </>
        )}
      </div>
    </div>
  )
}
