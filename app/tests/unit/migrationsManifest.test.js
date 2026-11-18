import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkMigrationsManifest } from '../../scripts/lib/migrationsManifest.mjs'

let root
const touch = (rel) => {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, '-- sql')
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'aloncar-mig-'))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('checkMigrationsManifest', () => {
  it('acepta numeración correlativa sin rollback antes del umbral', () => {
    touch('supabase/migrations/0001_init.sql')
    touch('supabase/migrations/0002_add_x.sql')
    const r = checkMigrationsManifest(root, { rollbackRequiredFrom: 3 })
    expect(r.errors).toEqual([])
    expect(r.maxNumber).toBe(2)
  })

  it('detecta huecos, duplicados y nombres inválidos', () => {
    touch('supabase/migrations/0001_init.sql')
    touch('supabase/migrations/0001_otro.sql')
    touch('supabase/migrations/0003_salto.sql')
    touch('supabase/migrations/4_Mal Nombre.sql')
    const r = checkMigrationsManifest(root, { rollbackRequiredFrom: 99 })
    expect(r.errors.some((e) => e.includes('duplicado 0001'))).toBe(true)
    expect(r.errors.some((e) => e.includes('falta 0002'))).toBe(true)
    expect(r.errors.some((e) => e.includes('nombre inválido'))).toBe(true)
  })

  it('exige rollback desde el umbral y detecta huérfanos', () => {
    touch('supabase/migrations/0001_init.sql')
    touch('supabase/migrations/0002_nueva.sql')
    touch('supabase/rollbacks/0009_fantasma.down.sql')
    touch('supabase/rollbacks/README.md')
    const r = checkMigrationsManifest(root, { rollbackRequiredFrom: 2 })
    expect(r.errors.some((e) => e.includes('0002_nueva.down.sql'))).toBe(true)
    expect(r.errors.some((e) => e.includes('huérfano'))).toBe(true)
  })

  it('pasa cuando la migración nueva trae su rollback', () => {
    touch('supabase/migrations/0001_init.sql')
    touch('supabase/migrations/0002_nueva.sql')
    touch('supabase/rollbacks/0002_nueva.down.sql')
    expect(checkMigrationsManifest(root, { rollbackRequiredFrom: 2 }).errors).toEqual([])
  })

  it('el repositorio real cumple la política vigente', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const r = checkMigrationsManifest(repoRoot)
    expect(r.errors).toEqual([])
    expect(r.migrationsCount).toBeGreaterThan(0)
  })
})
