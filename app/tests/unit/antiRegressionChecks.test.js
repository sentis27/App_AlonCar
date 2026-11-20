import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getPathLineLimit,
  checkFeaturesLockManifest,
  analyzeGitDiffText,
} from '../../scripts/lib/antiRegressionChecks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../../..')

describe('antiRegressionChecks (Candados #1, #3 y #4 en repo-hygiene)', () => {
  it('asigna umbrales diferenciados por ruta (path-based thresholds)', () => {
    expect(getPathLineLimit('app/src/schemas/purchases.schema.js').limit).toBe(200)
    expect(getPathLineLimit('app/src/repositories/purchaseOrdersRepository.js').limit).toBe(200)
    expect(getPathLineLimit('app/src/services/comprasAuxService.js').limit).toBe(250)
    expect(getPathLineLimit('app/src/lib/canonicalHelpers.js').limit).toBe(250)
    expect(getPathLineLimit('app/src/pages/Panol.jsx').limit).toBe(250)
    expect(getPathLineLimit('app/src/components/canonical/CanonicalMaterialPicker.jsx').limit).toBe(300)
  })

  it('valida el manifiesto real 08_FEATURES_LOCK.md con cero errores', () => {
    const res = checkFeaturesLockManifest(ROOT_DIR)
    expect(res.errors).toEqual([])
    expect(res.lockedCount).toBeGreaterThanOrEqual(8)
  })

  it('detecta regresiones en git diff cuando se borran <th>, isOpen: true, tooltip de OT o status:', () => {
    const simulatedBadDiff = [
      'diff --git a/app/src/components/panol/PanolMovimientosPanel.jsx b/app/src/components/panol/PanolMovimientosPanel.jsx',
      '--- a/app/src/components/panol/PanolMovimientosPanel.jsx',
      '+++ b/app/src/components/panol/PanolMovimientosPanel.jsx',
      '-              <th className="py-2">Stock</th>',
      '-              onOpenQuickPurchaseModal({ isOpen: true, material: mat })',
      '+              onOpenQuickPurchaseModal({ material: mat })',
      '-              const tip = formatWorkOrderTooltip(wo, ship)',
      '-              status: \'PEDIDO\',',
    ].join('\n')

    const alerts = analyzeGitDiffText(simulatedBadDiff)
    expect(alerts.length).toBe(4)
    expect(alerts.some((a) => a.includes('encabezado de columna'))).toBe(true)
    expect(alerts.some((a) => a.includes('isOpen: true'))).toBe(true)
    expect(alerts.some((a) => a.includes('tooltip flotante de OT'))).toBe(true)
    expect(alerts.some((a) => a.includes('transición de estado'))).toBe(true)
  })

  it('no dispara falsos positivos cuando una ocurrencia eliminada se reemplaza en el mismo diff', () => {
    const simulatedCleanDiff = [
      'diff --git a/app/src/components/panol/PanolMostradorRapidoPanel.jsx b/app/src/components/panol/PanolMostradorRapidoPanel.jsx',
      '--- a/app/src/components/panol/PanolMostradorRapidoPanel.jsx',
      '+++ b/app/src/components/panol/PanolMostradorRapidoPanel.jsx',
      '-              <th className="py-2">Stock</th>',
      '+              <th className="py-2 px-1.5">Stock Actual</th>',
      '-              const tip = formatWorkOrderTooltip(wo, ship)',
      '+              <CanonicalOtBadge wo={wo} ship={ship} />',
    ].join('\n')

    expect(analyzeGitDiffText(simulatedCleanDiff)).toEqual([])
  })
})
