import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadHygieneConfig } from '../../scripts/lib/hygieneConfig.mjs'
import {
  validateFeatureMapParity,
  checkFeatureMapIntegrity,
} from '../../scripts/lib/featureMapCheck.mjs'
import { runWhereQuery } from '../../scripts/lib/whereEngine.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

describe('sgai-core Etapa 3: Feature Map y data-testid en canónicos Core', () => {
  it('validateFeatureMapParity detecta módulo faltante/huérfano, submódulo faltante/huérfano y ownerPage inválido', () => {
    const nav = [
      { id: 'mod_a', children: [{ id: 'tab_1' }, { id: 'tab_2' }] },
      { id: 'mod_missing', children: [] },
    ]
    const badMap = {
      modules: {
        mod_a: {
          ownerPage: 'app/src/pages/Missing.jsx',
          readySelector: '[data-testid="ok"]',
          submodules: { tab_1: { smoke: true }, tab_orphan: { smoke: true } },
        },
        mod_orphan: {
          ownerPage: 'app/src/pages/Ok.jsx',
          readySelector: '[data-testid="ok"]',
          submodules: {},
        },
      },
    }

    const res = validateFeatureMapParity({
      navigationModules: nav,
      featureMap: badMap,
      fileExists: (rel) => rel === 'app/src/pages/Ok.jsx',
    })

    expect(res.errors.some((e) => e.includes('ownerPage'))).toBe(true)
    expect(res.errors.some((e) => e.includes('mod_a.tab_2'))).toBe(true)
    expect(res.errors.some((e) => e.includes('mod_a.tab_orphan'))).toBe(true)
    expect(res.errors.some((e) => e.includes('"mod_missing"'))).toBe(true)
    expect(res.errors.some((e) => e.includes('"mod_orphan"'))).toBe(true)

    const clean = validateFeatureMapParity({
      navigationModules: [{ id: 'mod_a', children: [{ id: 'tab_1' }] }],
      featureMap: {
        modules: {
          mod_a: {
            ownerPage: 'app/src/pages/Ok.jsx',
            readySelector: '[data-testid="ok"]',
            submodules: { tab_1: { smoke: true } },
          },
        },
      },
      fileExists: (rel) => rel === 'app/src/pages/Ok.jsx',
    })
    expect(clean.errors).toEqual([])
  })

  it('checkFeatureMapIntegrity valida paridad 1:1 (12 módulos, 41 submódulos, >=30 testids) en el repo real', async () => {
    const cfg = loadHygieneConfig(ROOT_DIR)
    const res = await checkFeatureMapIntegrity(ROOT_DIR, cfg)
    expect(res.errors).toEqual([])
    expect(res.moduleCount).toBe(12)
    expect(res.submoduleCount).toBe(41)
    expect(res.testIdCount).toBeGreaterThanOrEqual(30)
  })

  it('whereEngine incluye información FeatureMap compacta para panol', async () => {
    const cfg = loadHygieneConfig(ROOT_DIR)
    const res = await runWhereQuery(ROOT_DIR, 'panol', cfg)
    expect(res.found).toBe(true)
    expect(res.text).toContain('FeatureMap: owner=app/src/pages/Panol.jsx')
    expect(res.text.length).toBeLessThan(2500)
  })

  it('garantiza portabilidad 100% de featureMapCheck.mjs (cero tokens de AlonCar)', () => {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'app/scripts/lib/featureMapCheck.mjs'), 'utf8')
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
    for (const token of forbiddenProjectTokens) {
      expect(content, `featureMapCheck.mjs no debe contener "${token}"`).not.toContain(token)
    }
  })
})
