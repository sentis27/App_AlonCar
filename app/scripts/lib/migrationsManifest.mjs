/**
 * migrationsManifest.mjs
 * Verificación estructural de supabase/migrations y supabase/rollbacks (patrón adoptado de
 * Automatiza: cada migración nueva viaja con su rollback explícito).
 *
 * Reglas:
 *  R1. Nombre válido: NNNN_snake_case.sql
 *  R2. Numeración correlativa sin duplicados ni huecos (0001..max).
 *  R3. Desde ROLLBACK_REQUIRED_FROM, cada migración exige supabase/rollbacks/NNNN_<nombre>.down.sql
 *      (no es retroactivo: 0001..0048 se aplicaron antes de esta política).
 *  R4. No hay rollbacks huérfanos (sin migración correspondiente).
 */
import fs from 'node:fs'
import path from 'node:path'

export const ROLLBACK_REQUIRED_FROM = 49
const MIGRATION_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/
const ROLLBACK_RE = /^(\d{4})_([a-z0-9_]+)\.down\.sql$/

function listFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).sort()
}

export function checkMigrationsManifest(rootDir, { rollbackRequiredFrom = ROLLBACK_REQUIRED_FROM } = {}) {
  const errors = []
  const migDir = path.join(rootDir, 'supabase', 'migrations')
  const rbDir = path.join(rootDir, 'supabase', 'rollbacks')

  const migrations = []
  for (const name of listFiles(migDir)) {
    const m = name.match(MIGRATION_RE)
    if (!m) {
      errors.push(`Migración con nombre inválido (usar NNNN_snake_case.sql): supabase/migrations/${name}`)
      continue
    }
    migrations.push({ num: Number(m[1]), base: name.replace(/\.sql$/, ''), name })
  }

  const seen = new Map()
  for (const mig of migrations) {
    if (seen.has(mig.num)) errors.push(`Número de migración duplicado ${String(mig.num).padStart(4, '0')}: ${seen.get(mig.num)} y ${mig.name}`)
    else seen.set(mig.num, mig.name)
  }
  const max = migrations.reduce((mx, m) => Math.max(mx, m.num), 0)
  for (let n = 1; n <= max; n++) {
    if (!seen.has(n)) errors.push(`Hueco en la numeración de migraciones: falta ${String(n).padStart(4, '0')}`)
  }

  const rollbacks = new Set()
  for (const name of listFiles(rbDir)) {
    if (name === 'README.md') continue
    if (!ROLLBACK_RE.test(name)) {
      errors.push(`Rollback con nombre inválido (usar NNNN_nombre.down.sql): supabase/rollbacks/${name}`)
      continue
    }
    rollbacks.add(name.replace(/\.down\.sql$/, ''))
  }

  for (const mig of migrations) {
    if (mig.num >= rollbackRequiredFrom && !rollbacks.has(mig.base)) {
      errors.push(`Migración sin rollback: supabase/migrations/${mig.name} -> crear supabase/rollbacks/${mig.base}.down.sql`)
    }
  }
  const migBases = new Set(migrations.map((m) => m.base))
  for (const rb of rollbacks) {
    if (!migBases.has(rb)) errors.push(`Rollback huérfano sin migración: supabase/rollbacks/${rb}.down.sql`)
  }

  return { errors, migrationsCount: migrations.length, rollbacksCount: rollbacks.size, maxNumber: max }
}
