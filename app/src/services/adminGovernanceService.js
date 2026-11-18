/**
 * adminGovernanceService.js
 * Capa de servicio para Gobierno Admin: Alertas, Roles Organizacionales y Panel Macro (Candado #3: Cero SQL en Vista).
 */

import { materialsRepository } from '../repositories/materialsRepository.js'
import { complianceAlertsRepository } from '../repositories/complianceAlertsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'

export async function loadAdminAlertsComplianceService() {
  const [pendingMatsRes, complianceRes] = await Promise.all([
    materialsRepository.listMaterials({
      filters: { rubro_status: 'PENDIENTE_HOMOLOGACION' },
      orderBy: [{ column: 'created_at', ascending: false }],
    }),
    complianceAlertsRepository.listPending({
      select: '*, ships(name), workers(name)',
      orderBy: [{ column: 'created_at', ascending: false }],
    }),
  ])
  if (pendingMatsRes.error) throw new Error(pendingMatsRes.error)
  if (complianceRes.error) throw new Error(complianceRes.error)
  return {
    pendingMaterials: pendingMatsRes.data || [],
    complianceAlerts: complianceRes.data || [],
  }
}

export async function resolveAdminComplianceAlertService(alertId, patch) {
  const { error } = await complianceAlertsRepository.updateById(alertId, patch, { select: null })
  if (error) throw new Error(error)
  return { ok: true }
}

export async function approveWorkerPanolPermissionService(workerId) {
  if (!workerId) return { ok: true }
  const { error } = await workersRepository.updateById(workerId, { can_withdraw_materials: true }, { select: null })
  if (error) throw new Error(error)
  return { ok: true }
}

export async function approveMaterialRubroHomologationService(materialId, finalRubro) {
  const { error } = await materialsRepository.updateById(
    materialId,
    { rubro: finalRubro.trim().toUpperCase(), rubro_status: 'APROBADO' },
    { select: null }
  )
  if (error) throw new Error(error)
  return { ok: true }
}

export async function loadAdminRolesMatrixService() {
  const { data, error } = await organizationRolesRepository.listRoles({
    orderBy: [{ column: 'role_title', ascending: true }],
  })
  if (error) throw new Error(error)
  return data || []
}

export async function patchOrganizationRoleService(roleKey, patch) {
  const { error } = await organizationRolesRepository.updateRoleByKey(roleKey, patch, { select: null })
  if (error) throw new Error(error)
  return { ok: true }
}

export async function deleteOrganizationRoleService(roleKey) {
  const { error } = await organizationRolesRepository.deleteById(roleKey)
  if (error) throw new Error(error)
  return { ok: true }
}

export async function upsertOrganizationRoleService(payload) {
  const { data, error } = await organizationRolesRepository.upsertRole(payload)
  if (error) throw new Error(error)
  return data
}

export async function loadAdminMacroBoardDataService() {
  const [macroRes, ratesRes] = await Promise.all([
    macroVariablesRepository.listMacroVariables(),
    rateCardsRepository.listRateCards({
      select: 'period, year, month, quincena, dollar_rate, monthly_inflation_pct, is_locked, entity_name, admin_center',
    }),
  ])
  if (macroRes.error) throw new Error(macroRes.error)
  if (ratesRes.error) throw new Error(ratesRes.error)
  return {
    macroVariables: macroRes.data || [],
    rateCards: ratesRes.data || [],
  }
}

export async function quickSaveAdminMacroMonthService({ year, month, dollar_rate, monthly_inflation_pct, updated_by }) {
  const { error: macroErr } = await macroVariablesRepository.saveMonthlyVariables({
    year,
    month,
    dollar_rate,
    dollar_rate_1q: dollar_rate,
    dollar_rate_2q: dollar_rate,
    monthly_inflation_pct,
    updated_by,
    updated_at: new Date().toISOString(),
  })
  if (macroErr) throw new Error(macroErr)
  const { error: rcErr } = await rateCardsRepository.updateWhere(
    { filters: { year, month } },
    { dollar_rate, monthly_inflation_pct }
  )
  if (rcErr) throw new Error(rcErr)
  return { ok: true }
}

export async function adjustAdminQuincenaDollarService({ period, year, month, quincena, dollar_rate }) {
  const col = quincena === 1 ? 'dollar_rate_1q' : 'dollar_rate_2q'
  const { error: mErr } = await macroVariablesRepository.updateWhere(
    { filters: { year, month } },
    { [col]: dollar_rate, updated_at: new Date().toISOString() }
  )
  if (mErr) throw new Error(mErr)
  const { error: rcErr } = await rateCardsRepository.updateByPeriod(period, { dollar_rate })
  if (rcErr) throw new Error(rcErr)
  return { ok: true }
}

export async function deleteAdminMacroRecordService(macroId) {
  const { error } = await macroVariablesRepository.deleteById(macroId)
  if (error) throw new Error(error)
  return { ok: true }
}

export async function toggleAdminPeriodLockService({ period, year, month, quincena, isLocked }) {
  const col = quincena === 1 ? 'is_locked_1q' : 'is_locked_2q'
  const { error: mErr } = await macroVariablesRepository.updateWhere(
    { filters: { year, month } },
    { [col]: isLocked }
  )
  if (mErr) throw new Error(mErr)
  const { error: rcErr } = await rateCardsRepository.updateByPeriod(period, { is_locked: isLocked })
  if (rcErr) throw new Error(rcErr)
  return { ok: true }
}

export async function deleteAdminRateCardsByPeriodService(period) {
  const { error } = await rateCardsRepository.deleteWhere({ filters: { period } })
  if (error) throw new Error(error)
  return { ok: true }
}

export async function deleteAdminRateCardsByPeriodsService(periods = []) {
  if (!Array.isArray(periods) || periods.length === 0) return { ok: true }
  const { error } = await rateCardsRepository.deleteWhere({ inFilters: { period: periods } })
  if (error) throw new Error(error)
  return { ok: true }
}
