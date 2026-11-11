// ==============================================================================
// CONSTANTES Y HELPERS CANÓNICOS DEL MÓDULO DE COMPRAS (ALONCAR ERP)
// ==============================================================================

// Regla de Negocio: Para que una compra se cargue directamente a costo de obra:
// destino = DIRECTO y estado = RECIB.COMP.DIRECT.
// Si un material se pide para un barco específico (Buque ≠ Astillero), tiene que computarse al costo del barco.
// El KPI de Auditoría SOLO cuenta como error si:
// 1) destino = DIRECTO y estado = RECIBIDO (o RECIBIDO 2) y Buque ≠ Astillero (no se computaría al buque)
// 2) destino ≠ DIRECTO y Buque ≠ Astillero y estado in (RECIBIDO, RECIBIDO 2, RECIB.COMP.DIRECT) (destino mal asignado)
// Cancelados bajo ninguna circunstancia suman al contador. Compras no recibidas (PEDIR, PEDIDO, etc.) tampoco.
export function isCostAuditError(po, ships = []) {
  if (!po) return false

  const status = (po.status || '').toUpperCase()
  // Excluir de inmediato compras canceladas o no recibidas aún
  if (status === 'CANCELADOS') return false
  if (!['RECIBIDO', 'RECIBIDO 2', 'RECIB.COMP.DIRECT'].includes(status)) return false

  // Verificar si es Buque de Obra específico (Buque ≠ Astillero y no vacío)
  const astShip = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO'))
  const isAstilleroOrEmpty = !po.ship_id || (astShip && po.ship_id === astShip.id)
  const isSpecificShip = !isAstilleroOrEmpty
  if (!isSpecificShip) return false

  const isDirect = po.charge_type === 'DIRECT'

  // Caso 1: destino = directo Y estado = recibido Y Buque ≠ astillero (no se computaría al costo del buque)
  if (isDirect && (status === 'RECIBIDO' || status === 'RECIBIDO 2')) {
    return true
  }

  // Caso 2: destino ≠ directo Y Buque ≠ astillero Y (estado = recibido O estado = recib.comp.direct)
  if (!isDirect && ['RECIBIDO', 'RECIBIDO 2', 'RECIB.COMP.DIRECT'].includes(status)) {
    return true
  }

  return false
}

// Estados válidos según GS-006 (Ordenados según especificación operativa, texto corto visible y leyenda en tooltip)
export const STATUS_OPTIONS = [
  { value: 'TODOS', label: 'Todos los Estados', tooltip: 'Mostrar todos los estados', textColor: 'text-slate-300' },
  { value: 'PEDIR', label: 'PEDIR', tooltip: 'Por Emitir', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', textColor: 'text-amber-400' },
  { value: 'PEDIDO', label: 'PEDIDO', tooltip: 'Emitido a Prov.', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', textColor: 'text-blue-400' },
  { value: 'COTIZAR', label: 'COTIZAR', tooltip: 'A Pedir Precio', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', textColor: 'text-indigo-400' },
  { value: 'COTIZA.SOLICITUD', label: 'COTIZA.SOLICITUD', tooltip: 'Esperando', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', textColor: 'text-yellow-300' },
  { value: 'COTIZACION', label: 'COTIZACION', tooltip: 'En Evaluación', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', textColor: 'text-purple-400' },
  { value: 'COTIZA.APROBADA', label: 'COTIZA.APROBADA', tooltip: 'Aprobada', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', textColor: 'text-emerald-400' },
  { value: 'COTIZA.RECHAZADA', label: 'COTIZA.RECHAZADA', tooltip: 'Rechazada', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', textColor: 'text-rose-400' },
  { value: 'RECIBIDO', label: 'RECIBIDO', tooltip: 'Ingresó a Pañol', color: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50', textColor: 'text-emerald-400' },
  { value: 'RECIB.COMP.DIRECT', label: 'RECIB.COMP.DIRECT', tooltip: 'Imputado a Buque', color: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50', textColor: 'text-cyan-400' },
  { value: 'RECIBIDO 2', label: 'RECIBIDO 2', tooltip: 'Material de Cliente', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40', textColor: 'text-slate-300' },
  { value: 'PEDIDO INCOMPLETO', label: 'PEDIDO INCOMPLETO', tooltip: 'Parcial', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', textColor: 'text-orange-400' },
  { value: 'SE COMPRA?', label: 'SE COMPRA?', tooltip: 'Duda', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40', textColor: 'text-pink-400' },
  { value: 'CANCELADOS', label: 'CANCELADOS', tooltip: 'Orden cancelada', color: 'bg-red-500/20 text-red-400 border-red-500/40', textColor: 'text-rose-500' },
  { value: 'NO VENDEN', label: 'NO VENDEN', tooltip: 'Proveedor no comercializa el ítem', color: 'bg-slate-700/50 text-slate-400 border-slate-600', textColor: 'text-slate-500' }
]

// Lista estándar de rubros de proveedores para combobox
export const STANDARD_TRADES = [
  'FERRETERIA',
  'GASES',
  'TORNERIA',
  'PINTURA',
  'METALES',
  'CALDERERIA',
  'ELECTRICIDAD',
  'SERVICIOS',
  'BULONERIA',
  'MADERA',
  'HIDRAULICA',
  'CORTE/PLEGADO',
  'MECANICA',
  'SEGURIDAD',
  'LUBRICANTES'
]

// Lista oficial de Rubros de Materiales para B.D. Maestra
export const CATALOG_RUBROS = [
  'ABRAZADERA',
  'ACC. ALBAÑILERIA',
  'ACC. CINTAS PESCA',
  'ACC. HIDRAULICA',
  'ACC. PINTURA',
  'ACCESORIOS',
  'ACEITES',
  'ACOPLE/ADAPTADOR',
  'ALBAÑILERIA',
  'ANGULOS',
  'ARANDELAS',
  'BOMBAS',
  'BRIDAS',
  'BRONCE',
  'BUJE',
  'BULONES',
  'BURLETES',
  'CADENAS',
  'CAÑO',
  'CAÑO COBRE',
  'CAÑO INOX',
  'CAÑO PVC',
  'CHAPAS',
  'ELECTRICIDAD',
  'ELECTRODOS',
  'ELEM. SEGURIDAD',
  'EQUIPO ESPECIAL',
  'FABRICACION',
  'GASES',
  'GRIFERIA',
  'HERRAJES',
  'HERRAMIENTAS',
  'INS.MECANICA',
  'JUNTAS',
  'LIMPIEZA',
  'MACIZO',
  'MADERA',
  'MATERIALES',
  'MOTOR',
  'OTROS',
  'PEGAMENTO',
  'PERFILES ALUMINIO',
  'PINTURA',
  'REDUCCION',
  'RODAMIENTOS',
  'SOLDADURA',
  'TERMOFUSION',
  'TORNERIA',
  'VIDRIOS'
]

// Unidades de medida oficiales del sistema
export const OFFICIAL_UNITS = [
  { value: 'unidad', label: 'Unidad (un.)' },
  { value: 'm2', label: 'm2 (Lado x Lado / Área)' },
  { value: 'metro lineal', label: 'Metro Lineal (m)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'm3', label: 'Metros Cúbicos (m3)' },
  { value: 'Litros', label: 'Litros (L)' },
  { value: 'Caja', label: 'Caja' },
  { value: 'Bolsón', label: 'Bolsón' },
  { value: 'Rollo', label: 'Rollo' },
  { value: 'Barra', label: 'Barra' },
  { value: 'Chapa', label: 'Chapa' },
  { value: 'Tubo', label: 'Tubo' },
  { value: 'Pieza', label: 'Pieza' }
]

// Porcentajes de seguridad (Merma / Buffer Naval según módulo Pañol)
export const SECURITY_FACTORS = [
  { value: 1.02, label: '2% (Factor 1.02)' },
  { value: 1.06, label: '6% — Predeterminado (Factor 1.06)' },
  { value: 1.10, label: '10% (Factor 1.10)' },
  { value: 1.15, label: '15% (Factor 1.15)' },
  { value: 1.20, label: '20% (Factor 1.20)' },
  { value: 1.30, label: '30% (Factor 1.30)' }
]

// Función obligatoria de deducción estricta de unidad de medida por texto
export function deduceUnitMeasure(materialName = '') {
  const text = materialName.toLowerCase()
  if (text.includes('lado x lado')) return 'm2'
  if (text.includes('x metro lineal') || text.includes('x metro') || text.includes('metro lineal')) return 'metro lineal'
  if (text.includes('x kg') || text.includes('x kilo') || text.includes('kilo')) return 'kg'
  if (text.includes('x m3') || text.includes('metro cubico')) return 'm3'
  return 'unidad'
}

// Normalizador de teléfono argentino a formato WhatsApp internacional limpio (+54 9 [Área sin 0] [Número sin 15])
export function formatArgPhoneForWhatsApp(phoneStr = '') {
  if (!phoneStr) return ''
  const digits = phoneStr.replace(/[^0-9]/g, '')
  if (digits.startsWith('0810') || digits.startsWith('0800')) return digits // Línea fija no WhatsApp

  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) {
    return '549' + digits.slice(2)
  }
  let clean = digits.startsWith('0') ? digits.slice(1) : digits
  if (clean.length === 11 && clean.slice(3, 5) === '15') {
    clean = clean.slice(0, 3) + clean.slice(5)
  }
  return '549' + clean
}

// Helper para búsqueda avanzada y resaltado
export function getSearchMatchMap(po, searchQuery, suppliers = [], ships = [], documents = []) {
  if (!searchQuery || !searchQuery.trim()) return { hasMatch: false }
  const q = searchQuery.trim().toLowerCase()

  const matRaw = (po.material_name_raw || '').toLowerCase()
  const obs = (po.observations || '').toLowerCase()
  const req = (po.requested_by_name || '').toLowerCase()
  const trn = (po.freight_transport_name || '').toLowerCase()
  const sup = suppliers.find((s) => s.id === po.supplier_id)?.name.toLowerCase() || ''
  const shp = ships.find((s) => s.id === po.ship_id)?.name.toLowerCase() || ''

  const orderDocs = documents.filter((d) => d.purchase_order_id === po.id || (d.work_order_id && d.work_order_id === po.work_order_id))
  let docMatchDetail = null
  const docMatches = orderDocs.some((d) => {
    const fn = (d.original_filename || '').toLowerCase()
    const ds = (d.description || '').toLowerCase()
    const dt = (d.doc_type || '').toLowerCase()
    const txt = (d.extracted_text || '').toLowerCase()
    if (fn.includes(q)) { docMatchDetail = d.original_filename; return true }
    if (ds.includes(q)) { docMatchDetail = d.description; return true }
    if (dt.includes(q)) { docMatchDetail = d.doc_type; return true }
    if (txt.includes(q)) { docMatchDetail = `Texto en ${d.original_filename || 'PDF'}`; return true }
    return false
  })

  const isMaterial = matRaw.includes(q) || obs.includes(q)
  const isSupplier = sup.includes(q)
  const isShip = shp.includes(q)
  const isReq = req.includes(q)
  const isFreight = trn.includes(q)
  const isDoc = docMatches

  return {
    hasMatch: isMaterial || isSupplier || isShip || isReq || isFreight || isDoc,
    material: isMaterial,
    supplier: isSupplier,
    ship: isShip,
    requested_by: isReq,
    freight: isFreight,
    documents: isDoc,
    docMatchDetail
  }
}

export function parseOrderQueryParams(searchParams, materials = []) {
  const modeParam = searchParams.get('mode')
  let viewMode = null
  if (modeParam === 'simple' || modeParam === 'completa') {
    viewMode = modeParam
  }

  let newOrderPayload = null
  if (searchParams.get('nuevo') === 'true') {
    const matId = searchParams.get('materialId')
    const matName = searchParams.get('materialName') || ''
    const multiNames = searchParams.get('multiMaterials')

    let initialItems = null
    if (multiNames) {
      try {
        const parsed = JSON.parse(decodeURIComponent(multiNames))
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialItems = parsed.map((p) => ({
            material_id: p.id || null,
            material_name_raw: p.name || '',
            quantity: 1,
            unit_measure: p.unit_measure || 'Unidad',
            urgency: 'SIN_APURO'
          }))
        }
      } catch (e) {
        console.warn('Error parsing multiMaterials query param', e)
      }
    }

    let resolvedId = null
    let resolvedName = matName
    let resolvedUnit = 'Unidad'

    if (matId) {
      resolvedId = matId
      const found = materials.find((m) => m.id === matId)
      if (found) {
        resolvedName = found.name
        resolvedUnit = found.unit_measure || 'Unidad'
      }
    }

    newOrderPayload = {
      material_id: resolvedId,
      material_name_raw: resolvedName,
      charge_type: 'VIA_PANOL',
      unit_measure: resolvedUnit,
      quantity: 1,
      initialItems
    }
  }

  return { viewMode, newOrderPayload }
}

export function computeContractorGroups(workItems = [], suppliers = []) {
  const set = new Set()
  workItems.forEach((wi) => {
    const arr = Array.isArray(wi.contractors) ? wi.contractors : wi.contractor_name ? [wi.contractor_name] : []
    arr.forEach((c) => {
      const trimmed = String(c || '').trim()
      if (trimmed && !trimmed.toUpperCase().startsWith('ASTILLERO') && trimmed.toUpperCase() !== 'ALON CAR') {
        set.add(trimmed)
      }
    })
  })
  suppliers.forEach((s) => {
    if (s.is_contractor || s.category === 'CONTRATISTA' || (s.trade || '').toUpperCase().includes('CONTRATISTA')) {
      set.add(s.name.trim())
    }
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
}

export function getCurrentFortnight() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const q = now.getDate() <= 15 ? 'Q1' : 'Q2'
  return `${y}-${m}-${q}`
}

