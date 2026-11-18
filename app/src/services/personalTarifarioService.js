/**
 * personalTarifarioService.js
 * Capa de servicio para Análisis FX y Tarifario Quincenal (Candado #3: Cero SQL en Vista).
 */

import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'

export async function loadPersonalAnalysisComparisonService() {
  const [cardsRes, macroRes] = await Promise.all([
    rateCardsRepository.findAll({
      orderBy: [
        { column: 'year', ascending: true },
        { column: 'month', ascending: true },
        { column: 'quincena', ascending: true },
      ],
    }),
    macroVariablesRepository.listMacroVariables({
      orderBy: [
        { column: 'year', ascending: true },
        { column: 'month', ascending: true },
      ],
    }),
  ])
  if (cardsRes.error) throw new Error(cardsRes.error)
  if (macroRes.error) throw new Error(macroRes.error)
  return {
    cards: cardsRes.data || [],
    macroVariables: macroRes.data || [],
  }
}

export async function loadTarifarioOrgRolesService() {
  const { data, error } = await organizationRolesRepository.listRoles({ orderBy: [] })
  if (error) throw new Error(error)
  return data || []
}

export async function loadAllTarifarioRateCardsService() {
  const { data, error } = await rateCardsRepository.findAll({ orderBy: [] })
  if (error) throw new Error(error)
  return data || []
}

export async function loadTarifarioScopeRateCardsService(periodToLoad, scope = 'current') {
  const { data, error } = await rateCardsRepository.findAll({
    filters: scope === 'current' ? { period: periodToLoad } : {},
    orderBy: [
      { column: 'year', ascending: false },
      { column: 'month', ascending: false },
      { column: 'quincena', ascending: false },
      { column: 'admin_center', ascending: true },
      { column: 'entity_name', ascending: true },
    ],
  })
  if (error) throw new Error(error)
  return data || []
}

export async function upsertTarifarioRateCardsBatchService(rows = []) {
  const { error } = await rateCardsRepository.upsertMany(rows, {
    onConflict: 'period,admin_center,entity_name',
  })
  if (error) throw new Error(error)
  return { ok: true }
}

export async function saveAstilleroCategoryRateService(rateRow, { syncWorkers = false, category, ars, usd }) {
  const { error } = await rateCardsRepository.upsertOne(rateRow, {
    onConflict: 'period,admin_center,entity_name',
  })
  if (error) throw new Error(error)
  if (syncWorkers && ars > 0 && category) {
    const { error: wErr } = await workersRepository.updateWhere(
      { filters: { admin_center: 'ASTILLERO', category } },
      { hourly_rate_ars: ars, hourly_rate_usd: usd }
    )
    if (wErr) throw new Error(wErr)
  }
  return { ok: true }
}

export async function saveContractorRateAndSyncWorkersService(
  rateRow,
  { contractorName, hasAyudante, ofArs, ofUsd, ayArs = null, ayUsd = null }
) {
  const { error } = await rateCardsRepository.upsertOne(rateRow, {
    onConflict: 'period,admin_center,entity_name',
  })
  if (error) throw new Error(error)

  if (hasAyudante && ayArs > 0) {
    const { error: ayErr } = await workersRepository.updateWhere(
      {
        filters: { admin_center: 'CONTRATISTA' },
        orFilter: `work_group.eq.${contractorName} AYUDANTE,category.eq.${contractorName} AYUDANTE`,
      },
      { hourly_rate_ars: ayArs, hourly_rate_usd: ayUsd }
    )
    if (ayErr) throw new Error(ayErr)

    const { error: ofErr } = await workersRepository.updateWhere(
      {
        filters: { admin_center: 'CONTRATISTA', work_group: contractorName },
        neqFilters: { category: `${contractorName} AYUDANTE` },
      },
      { hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd }
    )
    if (ofErr) throw new Error(ofErr)
  } else if (ofArs > 0) {
    const { error: ofErr } = await workersRepository.updateWhere(
      { filters: { admin_center: 'CONTRATISTA', work_group: contractorName } },
      { hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd }
    )
    if (ofErr) throw new Error(ofErr)
  }

  return { ok: true }
}

export async function patchTarifarioRateCardCellService(rowId, dbPatch) {
  const { error } = await rateCardsRepository.updateById(rowId, dbPatch, { select: null })
  if (error) throw new Error(error)
  return { ok: true }
}
