import { supabase } from './supabase.js'
import { logRowAction, logCellChange } from './auditService.js'

/**
 * ==============================================================================
 * SERVICIO CENTRALIZADO DE VARIABLES MACROECONÓMICAS (ALON CAR ERP)
 * ==============================================================================
 * Fuente única de verdad para la fijación y sincronización de:
 * 1. Dólar oficial y dólar por quincenas (1Q / 2Q)
 * 2. Porcentaje de inflación mensual
 * 3. Cascada automática sobre `rate_cards` del mes
 * 4. Trazabilidad contable obligatoria en `audit_logs` (Padrón 2.B - A.3 / A.7)
 */

/**
 * Obtiene el historial completo de variables macroeconómicas ordenado cronológicamente
 */
export async function fetchMacroVariables() {
  const { data, error } = await supabase
    .from('macro_variables')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    console.error('[macroVariablesService.fetchMacroVariables] Error:', error)
    throw error
  }
  return data || []
}

/**
 * Obtiene las tarifas de operarios asociadas a un año y mes
 */
export async function fetchRateCardsForMonth(year, month) {
  const { data, error } = await supabase
    .from('rate_cards')
    .select('*')
    .eq('year', parseInt(year))
    .eq('month', parseInt(month))

  if (error) {
    console.error('[macroVariablesService.fetchRateCardsForMonth] Error:', error)
    throw error
  }
  return data || []
}

/**
 * Persiste las variables macroeconómicas, sincroniza rate_cards y genera registro de auditoría
 */
export async function saveMacroVariables({
  year,
  month,
  dollar_rate,
  dollar_rate_1q = null,
  dollar_rate_2q = null,
  monthly_inflation_pct = 0,
  updated_by = 'Administrador',
  previousValues = null,
  user = null
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

  // 1. Upsert en macro_variables
  const payload = {
    year: yr,
    month: mo,
    dollar_rate: dBase,
    dollar_rate_1q: d1q,
    dollar_rate_2q: d2q,
    monthly_inflation_pct: infPct,
    updated_by,
    updated_at: new Date().toISOString()
  }

  const { data: macroData, error: macroErr } = await supabase
    .from('macro_variables')
    .upsert(payload, { onConflict: 'year,month' })
    .select()
    .single()

  if (macroErr) {
    console.error('[macroVariablesService.saveMacroVariables] Error upsert:', macroErr)
    throw macroErr
  }

  // 2. Sincronizar automáticamente en las rate_cards del mes (1Q y 2Q)
  const q1Key = `${yr}-${String(mo).padStart(2, '0')}-1Q`
  const q2Key = `${yr}-${String(mo).padStart(2, '0')}-2Q`

  const [res1Q, res2Q] = await Promise.all([
    supabase
      .from('rate_cards')
      .update({ dollar_rate: d1q, monthly_inflation_pct: infPct })
      .eq('period', q1Key),
    supabase
      .from('rate_cards')
      .update({ dollar_rate: d2q, monthly_inflation_pct: infPct })
      .eq('period', q2Key)
  ])

  if (res1Q.error) console.warn('[macroVariablesService] Aviso actualizando rate_cards 1Q:', res1Q.error.message)
  if (res2Q.error) console.warn('[macroVariablesService] Aviso actualizando rate_cards 2Q:', res2Q.error.message)

  // 3. Trazabilidad inquebrantable en audit_logs
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
        monthly_inflation_pct: { from: previousValues?.monthly_inflation_pct ?? null, to: infPct }
      },
      rowData: payload,
      sheetName: 'Admin · Variables Macroeconómicas',
      moduleRoute: '/admin',
      user
    })
  } catch (auditErr) {
    console.error('[macroVariablesService] Advertencia registrando log de auditoría:', auditErr)
  }

  return macroData
}
