// ==============================================================================
// HELPERS PUROS DE MODALES AUXILIARES DE COMPRAS (M4)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

export const DOC_TYPE_OPTIONS = [
  { value: 'COTIZACION_MATERIAL', label: '📄 Cotización de Material (Visible en Compras)' },
  { value: 'COTIZACION_MANO_OBRA', label: '🔒 Cotización de Mano de Obra (Confidencial)' },
  { value: 'FICHA_TECNICA', label: '📐 Ficha Técnica / Manual Naval' },
  { value: 'IMAGEN_MUESTRA', label: '📸 Fotografía de Muestra / Rotura' },
  { value: 'REMITO', label: '🧾 Remito de Entrega' },
  { value: 'FACTURA', label: '💳 Factura Comercial' }
]

export const DOC_TYPE_BADGE_MAP = {
  COTIZACION_MATERIAL: {
    label: '📄 Cotiz. Material',
    className: 'bg-purple-950/80 text-purple-300 border-purple-800'
  },
  COTIZACION_MANO_OBRA: {
    label: '🔒 Mano de Obra',
    className: 'bg-rose-950/80 text-rose-300 border-rose-800'
  },
  FICHA_TECNICA: {
    label: '📐 Ficha Técnica',
    className: 'bg-blue-950/80 text-blue-300 border-blue-800'
  },
  IMAGEN_MUESTRA: {
    label: '📸 Muestra / Foto',
    className: 'bg-amber-950/80 text-amber-300 border-amber-800'
  },
  REMITO: {
    label: '🧾 Remito',
    className: 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
  },
  REMITO_FACTURA: {
    label: 'REMITO_FACTURA',
    className: 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
  }
}

export function getDocTypeBadge(docType) {
  return DOC_TYPE_BADGE_MAP[docType] || {
    label: docType || 'Documento',
    className: 'bg-purple-950/80 text-purple-300 border-purple-800'
  }
}

export function groupOrdersBySupplier(selectedOrderIds, purchaseOrders = [], suppliers = []) {
  const selected = purchaseOrders.filter((p) => selectedOrderIds.has(p.id))
  const map = new Map()
  selected.forEach((po) => {
    const sup = suppliers.find((s) => s.id === po.supplier_id) || {
      id: 'unknown',
      name: 'Sin Proveedor Asignado',
      phone: ''
    }
    if (!map.has(sup.id)) {
      map.set(sup.id, { supplier: sup, items: [] })
    }
    map.get(sup.id).items.push(po)
  })
  return Array.from(map.values())
}

export function buildBatchOrderWhatsAppText(supplierName, items = [], activeBuyer = { name: '', phone: '' }) {
  const hasIncompleto = items.some((i) => i.status === 'PEDIDO INCOMPLETO')

  if (hasIncompleto) {
    let text = `Estimados ${supplierName},\n`
    items.forEach((item) => {
      const orderDateFormatted = item.order_date || 'reciente'
      const remitoText = item.remito_number ? `según Remito N° ${item.remito_number}` : ''
      const origQty = (Number(item.quantity) || 0) + (Number(item.missing_quantity) || 0)
      const recQty = Number(item.received_quantity) || (origQty > item.quantity ? origQty - item.quantity : 0)
      const missQty = Number(item.quantity) || Number(item.missing_quantity) || 0

      text += `Acusamos recibo de la entrega para Astillero Alon Car correspondiente a la orden de compra del día ${orderDateFormatted} ${remitoText}.\n`
      text += `Sobre el pedido de ${origQty} ${item.unit_measure || 'unidades'} de ${item.material_name_raw}, se recibieron físicamente ${recQty} ${item.unit_measure || 'unidades'}.\n`
      text += `Quedan pendientes de entrega ${missQty} ${item.unit_measure || 'unidades'}.\n`
    })
    text += 'Agradecemos nos confirmen la fecha estimada de despacho del saldo faltante.\n\n'
    text += 'Atte. Departamento de Compras Alon Car S.A.'
    return encodeURIComponent(text)
  }

  let text = '*SOLICITUD DE COMPRA - ALON CAR S.A.*\n'
  text += `Estimados *${supplierName}*,\n`
  text += 'Por medio de la presente solicitamos cotización/entrega de los siguientes materiales:\n\n'

  items.forEach((item, idx) => {
    text += `*${idx + 1}.* ${item.material_name_raw} — Cantidad: *${item.quantity} ${item.unit_measure || 'unidades'}*`
    if (item.observations) text += ` _(Nota: ${item.observations})_`
    text += '\n'
  })

  text += '\n_Por favor confirmar disponibilidad y plazos de entrega._\n'
  text += `Muchas gracias.\n*Solicitado por: ${activeBuyer.name}*\n*Astillero & Metalúrgica Alon Car S.A.* (Tel: ${activeBuyer.phone})`
  return encodeURIComponent(text)
}

export function normalizeMaterialText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["'”’]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function computeMaterialSupplierHistory(order, purchaseOrders = [], suppliers = []) {
  const rawMaterialName = (order?.material_name_raw || '').trim()
  if (!rawMaterialName) return { materialHistory: [], totalMaterialMatches: 0 }

  const normTarget = normalizeMaterialText(rawMaterialName)
  const validOrders = purchaseOrders.filter((po) => po.id !== order.id && Boolean(po.supplier_id))

  let matches = validOrders.filter((po) => {
    const normName = normalizeMaterialText(po.material_name_raw)
    if (!normName) return false
    if (normName === normTarget) return true
    if (normTarget.length >= 4 && (normName.includes(normTarget) || normTarget.includes(normName))) return true
    return false
  })

  if (matches.length === 0) {
    const tokens = normTarget
      .split(/[\s,;-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !['de', 'la', 'el', 'en', 'para', 'con', 'x'].includes(t))

    if (tokens.length > 0) {
      const primaryNoun = tokens.find((t) => !/^\d+/.test(t)) || tokens[0]
      matches = validOrders.filter((po) => {
        const normName = normalizeMaterialText(po.material_name_raw)
        if (!normName) return false
        if (primaryNoun && !normName.includes(primaryNoun)) return false

        const matchedCount = tokens.filter((t) => normName.includes(t)).length
        const matchRatio = matchedCount / tokens.length
        return tokens.length <= 2 ? matchedCount === tokens.length : matchRatio >= 0.75
      })
    }
  }

  if (matches.length === 0) return { materialHistory: [], totalMaterialMatches: 0 }

  const totalMatches = matches.length
  const groupMap = new Map()

  matches.forEach((po) => {
    const sup = suppliers.find((s) => s.id === po.supplier_id)
    if (!sup) return
    if (!groupMap.has(po.supplier_id)) {
      groupMap.set(po.supplier_id, { supplier: sup, count: 0, orders: [] })
    }
    const entry = groupMap.get(po.supplier_id)
    entry.count++
    entry.orders.push(po)
  })

  const results = Array.from(groupMap.values()).map((item) => {
    item.orders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
    const last = item.orders[0]
    const lastPrice = last.supplier_quoted_price || last.system_unit_price || null
    const percentage = Math.round((item.count / totalMatches) * 100)

    return {
      supplier: item.supplier,
      count: item.count,
      totalMatches,
      percentage,
      lastPrice,
      lastDate: last.order_date,
      lastOrder: last
    }
  })

  results.sort((a, b) => b.count - a.count)
  return { materialHistory: results, totalMaterialMatches: totalMatches }
}

export function computeTradeSuppliers(selectedTrade, suppliers = [], purchaseOrders = [], searchDesc = '') {
  if (!selectedTrade) return []
  const cleanTrade = selectedTrade.toUpperCase()

  const sups = suppliers.filter((s) => {
    if (s.trades && Array.isArray(s.trades) && s.trades.includes(cleanTrade)) return true
    if (s.trade && s.trade.toUpperCase().includes(cleanTrade)) return true
    return false
  })

  const results = sups.map((sup) => {
    let lastPrice = null
    let lastDate = null
    const supOrders = purchaseOrders.filter((po) => po.supplier_id === sup.id)
    const count = supOrders.length

    if (searchDesc.trim()) {
      const qDesc = searchDesc.toLowerCase()
      const descMatches = supOrders.filter((po) => (po.material_name_raw || '').toLowerCase().includes(qDesc))
      if (descMatches.length > 0) {
        descMatches.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
        lastPrice = descMatches[0].supplier_quoted_price || descMatches[0].system_unit_price || null
        lastDate = descMatches[0].order_date
      }
    } else if (supOrders.length > 0) {
      supOrders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
      lastPrice = supOrders[0].supplier_quoted_price || supOrders[0].system_unit_price || null
      lastDate = supOrders[0].order_date
    }

    return { supplier: sup, count, lastPrice, lastDate }
  })

  const maxCount = Math.max(1, ...results.map((r) => r.count))
  return results
    .map((r) => ({ ...r, percentage: Math.round((r.count / maxCount) * 100) }))
    .sort((a, b) => b.count - a.count)
}

export function groupMandadoOrders(selectedIds, candidateOrders = [], suppliers = []) {
  const groups = new Map()
  selectedIds.forEach((id) => {
    const po = candidateOrders.find((p) => p.id === id)
    if (!po) return
    const sup = suppliers.find((s) => s.id === po.supplier_id)
    const supKey = sup?.id || 'SIN_PROV'
    if (!groups.has(supKey)) {
      groups.set(supKey, {
        supplier: sup,
        name: sup?.name || 'PROVEEDOR S/D',
        address: sup?.address || 'Mar del Plata',
        items: []
      })
    }
    groups.get(supKey).items.push(po)
  })
  return Array.from(groups.values())
}

export function buildMandadosWhatsAppMessage(groupedOrders = [], selectedWorker = null) {
  const workerFirstName = (selectedWorker?.name || 'compañero').split(',')[0].split(' ')[0].toLowerCase()
  let msg = `buenas ${workerFirstName}, podes pasar a retirar por favor:\n\n`

  groupedOrders.forEach((grp) => {
    msg += `*${grp.name}* (${grp.address}):\n`
    grp.items.forEach((it) => {
      const qty = Number(it.quantity) || 1
      const u = it.unit_measure ? ` ${it.unit_measure}` : ''
      const mat = it.material_name_raw || 'Material'
      msg += ` - ${qty}${u} ${mat}\n`
    })
    msg += '\n'
  })

  msg += '*Por favor retirar remito/factura.*'
  return msg
}
