import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadHygieneConfig, DEFAULT_HYGIENE_CONFIG } from '../../scripts/lib/hygieneConfig.mjs'
import {
  analyzeSourceArchitectureBoundaries,
  checkArchitectureBoundaries,
} from '../../scripts/lib/architectureBoundaries.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

describe('sgai-core architectureBoundaries y portabilidad del chasis', () => {
  it('bloquea imports de React o componentes UI dentro de app/src/lib/', () => {
    const violations = analyzeSourceArchitectureBoundaries([
      { rel: 'app/src/lib/badHelper.js', content: "import React from 'react'\nimport Modal from '../components/Modal.jsx'\nexport const x = 1" },
      { rel: 'app/src/lib/cleanHelper.js', content: "import { formatDate } from './dateUtils.js'\nexport const y = formatDate" },
    ], DEFAULT_HYGIENE_CONFIG)

    expect(violations).toHaveLength(2)
    expect(violations[0]).toContain('app/src/lib/badHelper.js')
    expect(violations[1]).toContain('app/src/lib/badHelper.js')
  })

  it('bloquea imports directos a repositories/ desde UI salvo allowlist', () => {
    const cfg = {
      ...DEFAULT_HYGIENE_CONFIG,
      architectureBoundaries: {
        ...DEFAULT_HYGIENE_CONFIG.architectureBoundaries,
        banDirectUiRepositoryImports: {
          enabled: true,
          allowlist: ['app/src/pages/AllowedPage.jsx'],
        },
      },
    }

    const violations = analyzeSourceArchitectureBoundaries([
      { rel: 'app/src/components/demo/Panel.jsx', content: "import repo from '../../repositories/itemsRepository'" },
      { rel: 'app/src/pages/BadPage.jsx', content: "import repo from '../repositories/itemsRepository'" },
      { rel: 'app/src/pages/AllowedPage.jsx', content: "import repo from '../repositories/itemsRepository'" },
      { rel: 'app/src/components/demo/CleanPanel.jsx', content: "import svc from '../../services/itemsService'" },
    ], cfg)

    expect(violations).toHaveLength(2)
    expect(violations.every((v) => !v.includes('AllowedPage.jsx') && !v.includes('CleanPanel.jsx'))).toBe(true)
  })

  it('bloquea componentes de clase React salvo allowlist', () => {
    const cfg = {
      ...DEFAULT_HYGIENE_CONFIG,
      architectureBoundaries: {
        ...DEFAULT_HYGIENE_CONFIG.architectureBoundaries,
        banReactClassComponents: {
          enabled: true,
          allowlist: ['app/src/components/canonical/ErrorBoundary.jsx'],
        },
      },
    }

    const violations = analyzeSourceArchitectureBoundaries([
      { rel: 'app/src/components/LegacyBox.jsx', content: 'class LegacyBox extends React.Component { render() { return null } }' },
      { rel: 'app/src/components/canonical/ErrorBoundary.jsx', content: 'export class ErrorBoundary extends Component {}' },
      { rel: 'app/src/components/ModernBox.jsx', content: 'export function ModernBox() { return null }' },
    ], cfg)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('LegacyBox.jsx')
  })

  it('bloquea onBlur={identificador} que filtra evento sintético y permite arrows seguros', () => {
    const violations = analyzeSourceArchitectureBoundaries([
      { rel: 'app/src/components/BadCell.jsx', content: '<input onBlur={commitValue} />' },
      { rel: 'app/src/components/GoodCell.jsx', content: '<input onBlur={() => commitValue()} onBlur={(e) => save(e.target.value)} onBlur={onBlur} />' },
    ], DEFAULT_HYGIENE_CONFIG)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('commitValue')
    expect(violations[0]).toContain('BadCell.jsx')
  })

  it('exige auditService en servicios con mutaciones y permite lecturas puras', () => {
    const violations = analyzeSourceArchitectureBoundaries([
      { rel: 'app/src/services/untracedService.js', content: 'export async function saveRow(id, data) { return repo.updateById(id, data) }' },
      { rel: 'app/src/services/tracedService.js', content: 'export async function saveRow(id, data) { const r = await repo.updateById(id, data); await auditService.logRowAction(); return r }' },
      { rel: 'app/src/services/readOnlyService.js', content: 'export async function listRows() { return repo.findAll() }' },
    ], DEFAULT_HYGIENE_CONFIG)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('untracedService.js')
  })

  it('bloquea imports cruzados entre módulos UI salvo sharedDirs, allowedTargets o allowlist', () => {
    const cfg = {
      ...DEFAULT_HYGIENE_CONFIG,
      architectureBoundaries: {
        ...DEFAULT_HYGIENE_CONFIG.architectureBoundaries,
        banCrossModuleComponentImports: {
          enabled: true,
          sharedComponentDirs: ['canonical'],
          allowedTargets: ['app/src/components/modB/SharedWidget'],
          allowlist: ['app/src/components/modA/AllowedBridge.jsx'],
        },
      },
    }

    const violations = analyzeSourceArchitectureBoundaries([
      { rel: 'app/src/components/modA/BadView.jsx', content: "import PanelB from '../modB/PanelB.jsx'" },
      { rel: 'app/src/components/modA/GoodCanonical.jsx', content: "import Bar from '../canonical/Toolbar.jsx'" },
      { rel: 'app/src/components/modA/GoodSharedRoot.jsx', content: "import Status from '../GridStatusBarBottom.jsx'" },
      { rel: 'app/src/components/modA/GoodLocal.jsx', content: "import Sub from './SubPanel.jsx'" },
      { rel: 'app/src/components/modA/GoodSharedTarget.jsx', content: "import Widget from '../modB/SharedWidget.jsx'" },
      { rel: 'app/src/components/modA/AllowedBridge.jsx', content: "import PanelB from '../modB/PanelB.jsx'" },
    ], cfg)

    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('BadView.jsx')
  })

  it('valida cero violaciones de arquitectura sobre el repositorio real', () => {
    const cfg = loadHygieneConfig(ROOT_DIR)
    expect(checkArchitectureBoundaries(ROOT_DIR, APP_DIR, cfg)).toEqual([])
  })

  it('garantiza portabilidad 100% del motor Core (cero tokens acoplados al proyecto)', () => {
    const coreFiles = [
      'app/scripts/repo-hygiene.mjs',
      'app/scripts/lib/antiRegressionChecks.mjs',
      'app/scripts/lib/architectureBoundaries.mjs',
      'app/scripts/lib/hygieneConfig.mjs',
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

    for (const rel of coreFiles) {
      const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8')
      for (const token of forbiddenProjectTokens) {
        expect(content, `${rel} no debe contener "${token}"`).not.toContain(token)
      }
    }
  })
})
