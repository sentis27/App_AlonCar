// ==============================================================================
// HELPERS PUROS DE FORMULARIO Y PARCHES DE CELDA PARA NÓMINA DE PERSONAL (M2)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { auditService } from './auditService.js'

export function resolveCenterDefaults({
  adminCenter = 'ASTILLERO',
  filterGroup = 'todos',
  availableContractorGroups = [],
  availableTallerGroups = [],
  dollarRate = 1500,
  rateOficial = 16365.76
} = {}) {
  let defaultGroup = 'ASTILLERO'
  let defaultDiscount = 0
  let defaultSafety = 'ASTILLERO'
  let defaultRate = rateOficial || 16365.76

  if (adminCenter === 'CONTRATISTA') {
    defaultGroup = filterGroup !== 'todos' && filterGroup !== 'ASTILLERO'
      ? filterGroup
      : (availableContractorGroups[0] || 'AVALOS')
    defaultDiscount = 100
    defaultSafety = 'CONTRATISTA'
    defaultRate = 17500
  } else if (adminCenter === 'TALLER') {
    defaultGroup = filterGroup !== 'todos' && filterGroup !== 'ASTILLERO'
      ? filterGroup
      : (availableTallerGroups[0] || 'CORMETAL')
    defaultDiscount = 100
    defaultSafety = 'CONTRATISTA'
    defaultRate = 18000
  }

  return {
    work_group: defaultGroup,
    consumables_discount_pct: defaultDiscount,
    consumables: defaultDiscount === 100 ? 'CONTRATISTA' : (defaultDiscount === 0 ? 'CLIENTE' : `DESC. ${defaultDiscount}%`),
    safety_items: defaultSafety,
    hourly_rate_ars: defaultRate,
    hourly_rate_usd: dollarRate > 0 ? Number((defaultRate / dollarRate).toFixed(2)) : 0,
    can_charge_third_party: adminCenter !== 'ASTILLERO'
  }
}

export function buildDefaultWorkerForm(opts = {}) {
  const adminCenter = opts.adminCenter || 'ASTILLERO'
  const defaults = resolveCenterDefaults({ ...opts, adminCenter })
  return {
    name: '',
    work_group: defaults.work_group,
    trade: 'CALDERERIA',
    admin_center: adminCenter,
    consumables: defaults.consumables,
    consumables_discount_pct: defaults.consumables_discount_pct,
    safety_items: defaults.safety_items,
    contract_type: '',
    contract_start_date: '',
    status: 'ACTIVO',
    hourly_rate_ars: defaults.hourly_rate_ars,
    hourly_rate_usd: defaults.hourly_rate_usd,
    category: 'OFICIAL',
    phone: '',
    can_withdraw_materials: true,
    can_impute_hours: true,
    can_charge_third_party: defaults.can_charge_third_party,
    is_foreman: false
  }
}

export function buildWorkerFormFromRecord(w, {
  availableContractorGroups = [],
  availableTallerGroups = [],
  dollarRate = 1500
} = {}) {
  const center = w.admin_center || 'ASTILLERO'
  const grp = w.work_group || 'ASTILLERO'

  let isCustomGroup = false
  if (center === 'CONTRATISTA' && !availableContractorGroups.includes(grp)) {
    isCustomGroup = true
  } else if (center === 'TALLER' && !availableTallerGroups.includes(grp)) {
    isCustomGroup = true
  }

  let discountPct = 100
  if (w.consumables_discount_pct !== undefined && w.consumables_discount_pct !== null) {
    discountPct = Number(w.consumables_discount_pct)
  } else {
    discountPct = (w.consumables || '').toUpperCase().includes('CLIENTE') ? 0 : 100
  }

  const ars = parseFloat(w.hourly_rate_ars) || 0
  const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : (parseFloat(w.hourly_rate_usd) || 0)

  return {
    isCustomGroup,
    customGroupName: isCustomGroup ? grp : '',
    formData: {
      name: w.name || '',
      work_group: grp,
      trade: w.trade || 'CALDERERIA',
      admin_center: center,
      consumables: w.consumables || (discountPct === 0 ? 'CLIENTE' : (discountPct === 100 ? 'CONTRATISTA' : `DESC. ${discountPct}%`)),
      consumables_discount_pct: discountPct,
      safety_items: w.safety_items || (center === 'ASTILLERO' ? 'ASTILLERO' : 'CONTRATISTA'),
      contract_type: w.contract_type || '',
      contract_start_date: w.contract_start_date ? String(w.contract_start_date).slice(0, 10) : '',
      status: w.status || 'ACTIVO',
      hourly_rate_ars: ars,
      hourly_rate_usd: usd,
      category: w.category || 'OFICIAL',
      phone: w.phone || '',
      can_withdraw_materials: w.can_withdraw_materials ?? true,
      can_impute_hours: w.can_impute_hours ?? true,
      can_charge_third_party: w.can_charge_third_party ?? (center !== 'ASTILLERO'),
      is_foreman: Boolean(w.is_foreman)
    }
  }
}

export function buildWorkerSavePayload(formData, {
  isCustomGroup = false,
  customGroupName = '',
  dollarRate = 1500
} = {}) {
  const ars = parseFloat(formData.hourly_rate_ars) || 0
  const usd = dollarRate > 0 ? parseFloat((ars / dollarRate).toFixed(2)) : (parseFloat(formData.hourly_rate_usd) || 0)

  let finalGroup = 'ASTILLERO'
  if (formData.admin_center !== 'ASTILLERO') {
    if (isCustomGroup && customGroupName.trim()) {
      finalGroup = customGroupName.trim().toUpperCase()
    } else {
      finalGroup = (formData.work_group || '').trim().toUpperCase()
    }
  }

  const discountPct = Number(formData.consumables_discount_pct ?? 100)
  let consumablesLabel = 'CLIENTE'
  if (discountPct === 100) {
    consumablesLabel = 'CONTRATISTA'
  } else if (discountPct > 0) {
    consumablesLabel = `DESC. ${discountPct}%`
  }

  return {
    finalGroup,
    payload: {
      name: formData.name.trim(),
      work_group: finalGroup,
      trade: formData.trade.trim().toUpperCase(),
      admin_center: formData.admin_center,
      consumables: consumablesLabel,
      consumables_discount_pct: discountPct,
      safety_items: formData.admin_center === 'ASTILLERO' ? 'ASTILLERO' : (formData.safety_items || 'CONTRATISTA'),
      contract_type: formData.admin_center === 'ASTILLERO' ? (formData.contract_type || null) : null,
      contract_start_date: formData.admin_center === 'ASTILLERO' && formData.contract_start_date ? formData.contract_start_date : null,
      status: formData.status,
      hourly_rate_ars: ars,
      hourly_rate_usd: usd,
      category: formData.category,
      phone: formData.phone?.trim() || null,
      can_withdraw_materials: Boolean(formData.can_withdraw_materials),
      can_impute_hours: Boolean(formData.can_impute_hours),
      can_charge_third_party: Boolean(formData.can_charge_third_party),
      is_foreman: Boolean(formData.is_foreman)
    }
  }
}

export function buildWorkerPatchFromCell(targetWorker, colKey, rawValue, dollarRate = 1500) {
  if (!targetWorker || auditService.isInvalidEventOrObjectScalar(rawValue)) return null

  if (colKey === 'hourly_rate_ars') {
    const ars = Math.max(0, parseFloat(rawValue) || 0)
    const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : (parseFloat(targetWorker.hourly_rate_usd) || 0)
    return { hourly_rate_ars: ars, hourly_rate_usd: usd }
  }
  if (colKey === 'admin_center') {
    const normalized = String(rawValue || '').trim().toUpperCase()
    const valid = ['ASTILLERO', 'CONTRATISTA', 'TALLER'].includes(normalized) ? normalized : targetWorker.admin_center
    return {
      admin_center: valid,
      safety_items: valid === 'ASTILLERO' ? 'ASTILLERO' : (targetWorker.safety_items || 'CONTRATISTA')
    }
  }
  if (colKey === 'safety_items') {
    const normalized = String(rawValue || '').trim().toUpperCase()
    const valid = targetWorker.admin_center === 'ASTILLERO'
      ? 'ASTILLERO'
      : (['ASTILLERO', 'CONTRATISTA'].includes(normalized) ? normalized : 'CONTRATISTA')
    return { safety_items: valid }
  }
  if (colKey === 'category' || colKey === 'trade' || colKey === 'work_group') {
    return { [colKey]: String(rawValue || '').trim().toUpperCase() }
  }
  if (colKey === 'name') {
    const trimmed = String(rawValue || '').trim()
    if (!trimmed || trimmed.toUpperCase() === '[OBJECT OBJECT]') return null
    return { name: trimmed }
  }
  return { [colKey]: rawValue }
}
