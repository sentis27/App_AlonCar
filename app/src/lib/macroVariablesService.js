import { logRowAction } from './auditService.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'

/**
 * ==============================================================================
 * SERVICIO CENTRALIZADO DE VARIABLES MACROECONÓMICAS (ALON CAR ERP)
 * ==============================================================================
 */

export async function fetchMacroVariables() {
  const { data, error } = await macroVariablesRepository.listMacroVariables()
  if (error) {
    console.error('[macroVariablesService.fetchMacroVariables] Error:', error)
    throw new Error(error)
  }
  return data || []
}

export async function fetchRateCardsForMonth(year, month) {
  const { data, error } = await rateCardsRepository.listRateCards({
    year: parseInt(year),
    month: parseInt(month),
  })
  if (error) {
    console.error('[macroVariablesService.fetchRateCardsForMonth] Error:', error)
    throw new Error(error)
  }
  return data || []
}

export async function saveMacroVariables({
  year,
  month,
  dollar_rate,
  dollar_rate_1q = null,
  dollar_rate_2q = null,
  monthly_inflation_pct = 0,
  updated_by = 'Administrador',
  previousValues = null,
  user = null,
}) {
  const yr = parseInt(year)
  const mo = parseInt(month)
  const dBase = parseFloat(dollar_rate) || 1500
  const d1q = dollar_rate_1q !== null && !isNaN(dollar_rate_1q) ? parseFloat(dollar_rate_1q) : dBase
  const d2q = dollar_rate_2q !== null && !isNaN(dollar_rate_2q) ? parseFloat(dollar_rate_2q) : dBase
  const infPct = parseFloat(monthly_inflation_pct) || 0

  if (!yr || !mo || mo < 1 || mo > 12) {
    throw new Error('Año y mes inválidos para variables macroeconómicas.')
  }

  const periodId = `${yr}-${String(mo).padStart(2, '0')}`
  const payload = {
    year: yr,
    month: mo,
    dollar_rate: dBase,
    dollar_rate_1q: d1q,
    dollar_rate_2q: d2q,
    monthly_inflation_pct: infPct,
    updated_by,
    updated_at: new Date().toISOString(),
  }

  const { data: macroData, error: macroErr } = await macroVariablesRepository.saveMonthlyVariables(payload)
  if (macroErr) {
    console.error('[macroVariablesService.saveMacroVariables] Error upsert:', macroErr)
    throw new Error(macroErr)
  }

  const q1Key = `${yr}-${String(mo).padStart(2, '0')}-1Q`
  const q2Key = `${yr}-${String(mo).padStart(2, '0')}-2Q`

  const [res1Q, res2Q] = await Promise.all([
    rateCardsRepository.updateByPeriod(q1Key, { dollar_rate: d1q, monthly_inflation_pct: infPct }),
    rateCardsRepository.updateByPeriod(q2Key, { dollar_rate: d2q, monthly_inflation_pct: infPct }),
  ])

  if (res1Q.error) console.warn('[macroVariablesService] Aviso actualizando rate_cards 1Q:', res1Q.error)
  if (res2Q.error) console.warn('[macroVariablesService] Aviso actualizando rate_cards 2Q:', res2Q.error)

  try {
    await logRowAction({
      action: 'MODAL_SAVE',
      entityType: 'macro_variables',
      entityId: periodId,
      entityName: `Parámetros Macro ${String(mo).padStart(2, '0')}/${yr}`,
      changes: {
        dollar_rate: { from: previousValues?.dollar_rate ?? null, to: dBase },
        dollar_rate_1q: { from: previousValues?.dollar_rate_1q ?? null, to: d1q },
        dollar_rate_2q: { from: previousValues?.dollar_rate_2q ?? null, to: d2q },
        monthly_inflation_pct: { from: previousValues?.monthly_inflation_pct ?? null, to: infPct },
      },
      rowData: payload,
      sheetName: 'Admin · Variables Macroeconómicas',
      moduleRoute: '/admin',
      user,
    })
  } catch (auditErr) {
    console.error('[macroVariablesService] Advertencia registrando log de auditoría:', auditErr)
  }

  return macroData
}
