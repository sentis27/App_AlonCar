import { useState } from 'react'
import { isCaldereriaChapter, buildCatalogBillingProse, evaluateShipWorkOrdersForGhostImport } from '../lib/billingMirrorEngine'
import { buildAutoFitLayoutMetaPatch } from '../lib/billingSheetMath'
import {
  buildBillingLineItemsFromTemplate, buildPricingModeChangePatch,
  normalizeBillingLineItems, replaceBlockHeadingInHtml, shouldTemplateDefaultToItemsMode
} from '../lib/billingLineItemsHelper'
import {
  openShipInBillingWorkspaceService, sendShipToFinalBillingService, saveShipBillingLayoutMetaService,
  importShipWorkOrdersGhostService, saveWorkOrderBillingPatchService, saveWorkOrderBillingOrderBatchService,
  requestBillingExpansionService, setShipBillingColorService, removeShipFromBillingWorkspaceService,
  syncShipBillingCostsAndOtsService
} from '../lib/billingWorkflowService'
import { archiveShipRemitoPdfService } from '../lib/billingPdfArchiveEngine'

/** Hook de acciones y persistencia de la Mesa Independiente Multi-Barco de Facturación. */
export function useBillingWorkspaceHandlers({
  allShips, activeShip, activeOwner, activeShipWos, workOrders, workItems, laborRows, materialRows,
  thirdPartyRows, workers, otTemplates, matchedTemplateByWoId, inPrepShips, effectiveShipId,
  orderedBlocks, pages, pageSummaries, grandTotal, otRowMap, ghostEval, printDensity, autoFitPreview,
  activeIssueDate, actorName, activeFlushRef, setBillingShipId, setNewBlockAutoFocusId, onReloadData, showFeedback
}) {
  const [importing, setImporting] = useState(false)
  const [refreshingCosts, setRefreshingCosts] = useState(false)
  const [sendingShip, setSendingShip] = useState(false)
  const [autoFitting, setAutoFitting] = useState(false)

  const saveLayoutMeta = async (nextMeta, nextBudget) => {
    if (!activeShip) return
    await saveShipBillingLayoutMetaService({ shipId: activeShip.id, shipName: activeShip.name, layoutMeta: nextMeta, budgetNumber: nextBudget, user: actorName })
    await onReloadData?.()
  }

  const runGuarded = async (setBusy, fn) => {
    try { setBusy?.(true); await fn() }
    catch (err) { showFeedback?.('error', err.message) }
    finally { setBusy?.(false) }
  }

  const patchBlock = async (block, patch, field, oldValue, newValue) => {
    if (!activeShip) return
    if (block.workOrderId) {
      await saveWorkOrderBillingPatchService({ woId: block.workOrderId, shipName: activeShip.name, otLabel: block.id, patch, field, oldValue, newValue, user: actorName })
      await onReloadData?.()
    } else {
      const meta = activeShip.billing_layout_meta || {}
      await saveLayoutMeta({ ...meta, customBlocks: (meta.customBlocks || []).map((b) => (b.id === block.id ? { ...b, ...patch } : b)) })
    }
  }

  const handleAddShipToWorkspace = (ship) => runGuarded(setImporting, async () => {
    activeFlushRef.current?.()
    const openedShip = (await openShipInBillingWorkspaceService({ ship, user: actorName })) || ship
    const shipWos = (workOrders || []).filter((w) => w.ship_id === ship.id && !w.merged_into_wo_id)
    let autoMsg = `Barco ${ship.name} abierto en tu Mesa de Facturación.`
    if (!shipWos.some((w) => w.is_in_billing) && ship.billing_workspace_status !== 'ENVIADO_A_FACTURACION') {
      const plan = evaluateShipWorkOrdersForGhostImport({
        shipWos, workItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates,
        existingCustomBlocks: openedShip.billing_layout_meta?.customBlocks || []
      })
      if (plan.readyToImport.length > 0) {
        const { importedCount } = await importShipWorkOrdersGhostService({ ship: openedShip, ...plan, user: actorName })
        autoMsg = `Barco ${ship.name} abierto · ${importedCount} OT(s) importadas automáticamente en orden PDF.`
      }
    }
    setBillingShipId(ship.id)
    await onReloadData?.()
    showFeedback?.('success', autoMsg)
  })

  const handleRemoveShipFromWorkspace = async (ship) => {
    if (!ship?.id || !window.confirm(`¿Quitar "${ship.name}" del panel izquierdo de facturación? (No borra el buque ni sus OTs).`)) return
    await runGuarded(null, async () => {
      activeFlushRef.current?.()
      await removeShipFromBillingWorkspaceService({ ship, user: actorName })
      if (effectiveShipId === ship.id) setBillingShipId(inPrepShips.find((s) => s.id !== ship.id)?.id || '')
      await onReloadData?.()
      showFeedback?.('success', `${ship.name} quitado del panel de facturación.`)
    })
  }

  const handleImportAll = async () => {
    if (!activeShip) return
    if (ghostEval.readyToImport.length === 0) {
      showFeedback?.('success', 'No hay nuevas OTs con descripción cargada pendientes de importar.')
      return
    }
    await runGuarded(setImporting, async () => {
      const { importedCount } = await importShipWorkOrdersGhostService({ ship: activeShip, ...ghostEval, user: actorName })
      await onReloadData?.()
      showFeedback?.('success', `${importedCount} OT(s) importadas en modo fantasma y ordenadas según PDF.`)
    })
  }

  const handleRefreshCosts = () => activeShip && runGuarded(setRefreshingCosts, async () => {
    activeFlushRef.current?.()
    const { reorderedCount } = await syncShipBillingCostsAndOtsService({
      ship: activeShip, shipWos: activeShipWos, workItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates, user: actorName
    })
    await onReloadData?.()
    showFeedback?.('success', reorderedCount > 0 ? 'Costos actualizados y OTs ordenadas según PDF.' : 'Costos actualizados.')
  })

  const handleNotifyEmptyOts = () => activeShip && runGuarded(null, async () => {
    for (const al of ghostEval.emptyDescriptionAlerts) {
      const wo = activeShipWos.find((w) => w.id === al.workOrderId)
      if (wo) await requestBillingExpansionService({ wo, ship: activeShip, note: 'OT detectada con descripción vacía al intentar importar a Facturación.', user: actorName })
    }
    await onReloadData?.()
    showFeedback?.('success', `Se notificó al Jefe de Obra y Administrador por ${ghostEval.emptyDescriptionAlerts.length} OT(s) sin descripción.`)
  })

  const handleAddRubroDelimiter = async (code, label) => {
    if (!activeShip) return
    const meta = activeShip.billing_layout_meta || {}
    const maxSort = orderedBlocks.reduce((m, b) => Math.max(m, b.sortOrder || 0), 0)
    await saveLayoutMeta({ ...meta, customBlocks: [...(meta.customBlocks || []), { id: `delim_${Date.now()}`, blockType: 'RUBRO_DELIMITER', code, label, sortOrder: maxSort + 10 }] })
  }

  const handleAddFreeBlock = async () => {
    if (!activeShip) return
    const meta = activeShip.billing_layout_meta || {}
    const maxSort = orderedBlocks.reduce((m, b) => Math.max(m, b.sortOrder || 0), 0)
    const id = `free_${Date.now()}`
    setNewBlockAutoFocusId(id)
    await saveLayoutMeta({ ...meta, customBlocks: [...(meta.customBlocks || []), { id, blockType: 'FREE_BLOCK', sortOrder: maxSort + 10, billing_description: '', billing_pricing_mode: 'MO_MAT', billing_mo_usd: 0, billing_mat_usd: 0, billing_unit_price_usd: 0, billing_qty_override: null, billing_mo_tax: 'EXENTO', billing_mat_tax: 'EXENTO', billing_line_items: [], fontSizePx: 12 }] })
  }

  const handleCommitProse = async ({ shipId, blockId, nextHtml, fontSizePx }) => {
    const targetShip = (allShips || []).find((s) => s.id === shipId) || activeShip
    if (!targetShip) return
    if (String(blockId).startsWith('wo_')) {
      const woId = blockId.slice(3)
      const wo = workOrders.find((w) => w.id === woId)
      await saveWorkOrderBillingPatchService({ woId, shipName: targetShip.name, otLabel: `${wo?.ot_number || 'OT'} ${wo?.title || ''}`, patch: { billing_description: nextHtml }, field: 'billing_description', oldValue: wo?.billing_description || '', newValue: nextHtml, user: actorName })
      const meta = targetShip.billing_layout_meta || {}
      if (fontSizePx && meta.fontSizes?.[woId] !== fontSizePx) {
        await saveShipBillingLayoutMetaService({ shipId: targetShip.id, shipName: targetShip.name, layoutMeta: { ...meta, fontSizes: { ...(meta.fontSizes || {}), [woId]: fontSizePx } }, user: actorName })
      }
      await onReloadData?.()
    } else {
      const meta = targetShip.billing_layout_meta || {}
      await saveShipBillingLayoutMetaService({ shipId: targetShip.id, shipName: targetShip.name, layoutMeta: { ...meta, customBlocks: (meta.customBlocks || []).map((b) => (b.id === blockId ? { ...b, billing_description: nextHtml, fontSizePx } : b)) }, user: actorName })
      await onReloadData?.()
    }
  }

  const handleRefreshFromCatalog = async (block, matchedTpl) => {
    if (!activeShip || !block?.workOrderId || !matchedTpl) return
    const wo = activeShipWos.find((w) => w.id === block.workOrderId)
    const nextProse = buildCatalogBillingProse(matchedTpl, wo?.title)
    if (!nextProse || !window.confirm(`¿Reemplazar el texto actual de "${wo?.title || matchedTpl.name}" por la descripción de facturación oficial del Catálogo OT.ABC?`)) return
    const patch = {
      billing_description: nextProse,
      ...((block.billing_pricing_mode === 'ITEMS' || shouldTemplateDefaultToItemsMode(matchedTpl))
        ? { billing_line_items: buildBillingLineItemsFromTemplate(matchedTpl) }
        : {})
    }
    await saveWorkOrderBillingPatchService({ woId: block.workOrderId, shipName: activeShip.name, otLabel: `${wo?.ot_number || 'OT'} ${wo?.title || matchedTpl.name}`, patch, field: 'billing_description', oldValue: block.billing_description || '', newValue: nextProse, user: actorName })
    await onReloadData?.()
    showFeedback?.('success', `Descripción de facturación actualizada desde Catálogo OT.ABC (${matchedTpl.name}).`)
  }

  const handleRemoveBlock = async (block) => {
    if (!activeShip) return
    if (block.workOrderId) {
      await saveWorkOrderBillingPatchService({ woId: block.workOrderId, shipName: activeShip.name, otLabel: block.id, patch: { is_in_billing: false }, field: 'is_in_billing', oldValue: true, newValue: false, user: actorName })
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
    const woUpdates = []; const nextCustom = []
    list.forEach((b, idx) => {
      const nextSort = (idx + 1) * 10
      if (b.blockType === 'RUBRO_DELIMITER') { currentRubro = b.code || b.label || ''; nextCustom.push({ ...b, sortOrder: nextSort }) }
      else if (b.workOrderId) {
        const nextRubro = currentRubro || b.billing_rubro_group || (isCaldereriaChapter(currentRubro) ? 'CALDERERIA' : '')
        woUpdates.push({ id: b.workOrderId, patch: { billing_sort_order: nextSort, ...(currentRubro ? { billing_rubro_group: nextRubro } : {}) } })
      } else nextCustom.push({ ...b, sortOrder: nextSort })
    })
    await saveWorkOrderBillingOrderBatchService({ updates: woUpdates, shipName: activeShip.name, user: actorName })
    await saveLayoutMeta({ ...(activeShip.billing_layout_meta || {}), customBlocks: nextCustom })
  }

  const handleAutoFitA4 = () => activeShip && runGuarded(setAutoFitting, async () => {
    activeFlushRef.current?.()
    const { nextMeta, feedbackMessage } = buildAutoFitLayoutMetaPatch({ meta: activeShip.billing_layout_meta || {}, orderedBlocks, printDensity, autoFitPreview })
    await saveLayoutMeta(nextMeta)
    showFeedback?.('success', feedbackMessage)
  })

  const handleSendShipToFinalBilling = async () => {
    if (!activeShip || !window.confirm(`¿Enviar "${activeShip.name}" a Listos para Facturar con saldo ${grandTotal.totalUsd.toFixed(2)} USD? Se archivará el PDF adjunto del remito.`)) return
    await runGuarded(setSendingShip, async () => {
      activeFlushRef.current?.()
      let archivedPdfEntry = null
      try {
        archivedPdfEntry = await archiveShipRemitoPdfService({ ship: activeShip, owner: activeOwner, budgetNumber: activeShip.billing_budget_number || '', issueDate: activeIssueDate, pages, pageSummaries, otRowMap, grandTotal, user: actorName })
      } catch (pdfErr) { console.warn('[archiveShipRemitoPdfService] Fallo adjuntando PDF:', pdfErr?.message) }
      await sendShipToFinalBillingService({ ship: activeShip, totalSnapshotUsd: grandTotal.totalUsd, budgetNumber: activeShip.billing_budget_number || '', archivedPdfEntry, user: actorName })
      setBillingShipId(inPrepShips.find((s) => s.id !== activeShip.id)?.id || '')
      await onReloadData?.()
      showFeedback?.('success', archivedPdfEntry?.fileUrl ? `${activeShip.name} enviado a Facturación y PDF archivado (${archivedPdfEntry.fileName}).` : `${activeShip.name} enviado a Facturación / Listos para Cobrar.`)
    })
  }

  return {
    importing, refreshingCosts, sendingShip, autoFitting, saveLayoutMeta,
    handleSwitchShip: (nextId) => { activeFlushRef.current?.(); setNewBlockAutoFocusId(null); setBillingShipId(nextId) },
    handleAddShipToWorkspace, handleRemoveShipFromWorkspace,
    handleSetShipColor: (ship, color) => runGuarded(null, async () => { await setShipBillingColorService({ ship, color, user: actorName }); await onReloadData?.() }),
    handleImportAll, handleRefreshCosts, handleNotifyEmptyOts, handleAddRubroDelimiter, handleAddFreeBlock,
    handleCommitProse, handleRefreshFromCatalog, handleRemoveBlock, handleReorderBlocks, handleAutoFitA4, handleSendShipToFinalBilling,
    handleCommitPriceField: (block, field, val) => patchBlock(block, { [field]: val }, field, block[field], val),
    handleCommitLineItems: (block, nextItems) => { const n = normalizeBillingLineItems(nextItems); return patchBlock(block, { billing_line_items: n }, 'billing_line_items', block.billing_line_items, n) },
    handleCommitHeading: (block, nextHeading) => activeShip && handleCommitProse({ shipId: activeShip.id, blockId: block.id, nextHtml: replaceBlockHeadingInHtml(block.billing_description || '', nextHeading), fontSizePx: block.fontSizePx || 12 }),
    handleChangePricingMode: (block, mode) => { const p = buildPricingModeChangePatch(block, mode, block.workOrderId ? matchedTemplateByWoId?.get(block.workOrderId) : null); return patchBlock(block, p, 'billing_pricing_mode', block.billing_pricing_mode, mode) },
    handleChangeIssueDate: (nextIso) => activeShip && nextIso && saveLayoutMeta({ ...(activeShip.billing_layout_meta || {}), issueDate: nextIso }),
    handleToggleTax: (block, taxField) => patchBlock(block, { [taxField]: block[taxField] === 'GRAVADO_21' ? 'EXENTO' : 'GRAVADO_21' }, taxField, block[taxField], block[taxField] === 'GRAVADO_21' ? 'EXENTO' : 'GRAVADO_21'),
    handleRequestExpansion: async (otRow, note) => {
      const wo = activeShipWos.find((w) => w.id === otRow.id)
      if (!wo || !activeShip) return
      await requestBillingExpansionService({ wo, ship: activeShip, note, user: actorName })
      await onReloadData?.()
      showFeedback?.('success', `Acuse de ampliación enviado a ${otRow.foremanName || 'Jefe de Obra'} + Administrador.`)
    }
  }
}
