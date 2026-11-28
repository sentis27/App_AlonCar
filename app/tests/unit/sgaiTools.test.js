import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getTodayArIso,
  syncMetadataIndexContent,
  runMetaSync,
} from '../../scripts/lib/metaSyncEngine.mjs'
import {
  buildWhereReport,
  runWhereQuery,
} from '../../scripts/lib/whereEngine.mjs'
import { loadHygieneConfig } from '../../scripts/lib/hygieneConfig.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

const SAMPLE_INDEX = [
  '# Índice de Metadatos',
  '',
  '> **Última actualización:** 2026-11-01',
  '',
  '| Archivo | Tipo | Comportamiento-IA | Lectura | Fase | Estado | Última revisión | Depende de |',
  '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  '| GEMINI.md | instrucciones-agente | auditar-reglas \\| consultar-siempre | completo | transversal | activo | 2026-11-01 | ninguno |',
  '| app/src/pages/Demo.jsx | codigo | ninguno | ignorar | transversal | activo | 2026-11-01 | ninguno |',
  '| docs/deleted.md | guia | ninguno | cambios | transversal | activo | 2026-11-01 | ninguno |',
  '',
].join('\n')

function readVersion(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const m = raw.match(/^---\r?\n[\s\S]*?\bversion:\s*([^\r\n]+)/)
  return m ? m[1].trim() : null
}

describe('sgai-core Etapa 2: metaSyncEngine, whereEngine, portabilidad y dieta de tokens', () => {
  it('getTodayArIso devuelve formato YYYY-MM-DD válido', () => {
    expect(getTodayArIso(new Date('2026-11-28T01:30:00Z'))).toBe('2026-11-27')
    expect(getTodayArIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('syncMetadataIndexContent agrega .md nuevos, elimina huérfanos, preserva código y actualiza fecha solo en delta', () => {
    const existing = new Set(['GEMINI.md', 'app/src/pages/Demo.jsx', 'docs/new.md'])
    const res = syncMetadataIndexContent({
      rawContent: SAMPLE_INDEX,
      activeMdFiles: ['GEMINI.md', 'docs/new.md'],
      existingPathCheck: (rel) => existing.has(rel),
      changedFiles: new Set(['GEMINI.md']),
      todayIso: '2026-11-27',
    })

    expect(res.changed).toBe(true)
    expect(res.added).toBe(1)
    expect(res.removed).toBe(1)
    expect(res.updated).toBe(1)
    expect(res.nextContent).toContain('> **Última actualización:** 2026-11-27')
    expect(res.nextContent).toContain('| GEMINI.md | instrucciones-agente | auditar-reglas \\| consultar-siempre | completo | transversal | activo | 2026-11-27 | ninguno |')
    expect(res.nextContent).toContain('| app/src/pages/Demo.jsx | codigo | ninguno | ignorar | transversal | activo | 2026-11-01 | ninguno |')
    expect(res.nextContent).toContain('| docs/new.md |')
    expect(res.nextContent).not.toContain('docs/deleted.md')
  })

  it('runMetaSync --check confirma INDICE_METADATOS.md 100% sincronizado en el repo real', () => {
    const res = runMetaSync(ROOT_DIR, { checkOnly: true })
    expect(res.changed).toBe(false)
    expect(res.added).toBe(0)
    expect(res.removed).toBe(0)
    expect(res.updated).toBe(0)
  })

  it('whereEngine resuelve --list, módulos, submódulo, acentos y contratos FL-* en salida compacta', async () => {
    const cfg = loadHygieneConfig(ROOT_DIR)
    const listRes = await runWhereQuery(ROOT_DIR, '--list', cfg)
    expect(listRes.found).toBe(true)
    expect(listRes.text).toContain('panol | /panol')
    expect(listRes.text.length).toBeLessThan(2500)

    for (const q of ['panol', 'horas', 'ots', 'panol.planillas', 'FL-024', 'tesoreria', 'tesorería']) {
      const res = await runWhereQuery(ROOT_DIR, q, cfg)
      expect(res.found, `where("${q}") debe encontrar resultado`).toBe(true)
      expect(res.text.length, `where("${q}") debe mantenerse compacto`).toBeLessThan(2500)
    }

    const sub = await runWhereQuery(ROOT_DIR, 'panol.planillas', cfg)
    expect(sub.text).toContain('*planillas')

    const miss = buildWhereReport({ query: 'modulo_inexistente_xyz', modules: [], sourceFiles: [], lockRows: [] })
    expect(miss.found).toBe(false)
  })

  it('garantiza portabilidad 100% de sync-meta y where (cero tokens de AlonCar)', () => {
    const toolFiles = [
      'app/scripts/sync-meta.mjs',
      'app/scripts/lib/metaSyncEngine.mjs',
      'app/scripts/where.mjs',
      'app/scripts/lib/whereEngine.mjs',
    ]
    const forbiddenProjectTokens = [
      'AlonCar',
      'PanolMovimientosPanel',
      'WorkOrders',
      'Vanoli',
      'senti',
      'Presentacion',
      'work_items',
      'TAREAS_PENDIENTES',
      'BITACORA_DELTAS_SESION',
      'PLAN_OPTIMIZACION_IA',
    ]

    for (const rel of toolFiles) {
      const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8')
      for (const token of forbiddenProjectTokens) {
        expect(content, `${rel} no debe contener "${token}"`).not.toContain(token)
      }
    }
  })

  it('cumple Token Diet Gate: GEMINI.md < 5,500 B y versión sincronizada con CLAUDE.md', () => {
    const geminiPath = path.join(ROOT_DIR, 'GEMINI.md')
    const claudePath = path.join(ROOT_DIR, 'CLAUDE.md')
    const geminiBytes = fs.statSync(geminiPath).size
    expect(geminiBytes).toBeLessThan(5500)
    expect(readVersion(geminiPath)).toBeTruthy()
    expect(readVersion(geminiPath)).toBe(readVersion(claudePath))
  })
})
