/**
 * antiRegressionChecks.mjs
 * Guardias mecánicos de los Candados #1, #2, #3 y #4 integrados en `repo-hygiene.mjs`.
 * Corre localmente en Node (0 tokens de IA).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const CODE_EXT_RE = /\.(?:js|jsx|ts|tsx)$/
const toPosix = (p) => p.split(path.sep).join('/')

/**
 * Candado #3: Umbrales diferenciados por ruta (inspirado en code-refactoring v2.0.0).
 * Evita partir componentes visuales cohesivos de forma artificial mientras mantiene estrictas
 * las capas de esquemas, repositorios, servicios, hooks y páginas.
 */
export function getPathLineLimit(rel) {
  if (/^app\/src\/(?:schemas|repositories)\//.test(rel)) return { limit: 200, label: 'schemas/repositories' }
  if (/^app\/src\/(?:lib|hooks|services|pages)\//.test(rel)) return { limit: 250, label: 'lib/hooks/services/pages' }
  if (/^app\/src\/components\//.test(rel)) return { limit: 300, label: 'components' }
  return { limit: 300, label: 'app/src' }
}

/**
 * Candado #1: Verifica existencia e integridad de IDs en `08_FEATURES_LOCK.md`.
 */
export function checkFeaturesLockManifest(rootDir) {
  const rel = 'docs/02_producto/estandares/08_FEATURES_LOCK.md'
  const full = path.join(rootDir, rel)
  if (!fs.existsSync(full)) {
    return { errors: [`Falta manifiesto de funcionalidades blindadas: ${rel}`], lockedCount: 0, pendingCount: 0 }
  }

  const raw = fs.readFileSync(full, 'utf8')
  const seen = new Set()
  const errors = []
  let lockedCount = 0
  let pendingCount = 0

  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(FL-\d+)\s*\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*(blindado|pendiente_fix)\s*\|/)
    if (!m) continue
    const id = m[1].trim()
    const state = m[2].trim()
    if (seen.has(id)) errors.push(`ID duplicado ${id} en ${rel}`)
    seen.add(id)
    if (state === 'blindado') lockedCount++
    else pendingCount++
  }

  if (lockedCount === 0) {
    errors.push(`${rel} no contiene ningún contrato en estado "blindado"`)
  }
  return { errors, lockedCount, pendingCount }
}

/**
 * Candado #2: Ratchet de Componentes Canónicos.
 * Prohíbe crear NUEVOS `<datalist id="...materials...">` o `list="...materials..."` en vez de usar
 * `CanonicalMaterialPicker`. Los archivos legacy preexistentes figuran en allowlist como alerta
 * hasta su migración; cualquier archivo nuevo fuera del allowlist falla como ERROR bloqueante.
 */
const LEGACY_MATERIAL_DATALIST_ALLOWLIST = new Set([])

const RAW_MATERIAL_DATALIST_RE = /(?:<datalist\b[^>]*\bid=["'][^"']*material[^"']*["']|\blist=["'][^"']*material[^"']*["'])/i

const REQUIRED_CANONICAL_OT_SURFACES = [
  'app/src/components/panol/PanolMovimientosPanel.jsx',
  'app/src/components/compras/ComprasPedidoRow.jsx',
  'app/src/components/terceros/TercerosFilasPanel.jsx',
  'app/src/components/terceros/TercerosFichasPanel.jsx',
  'app/src/components/labor/LaborLogsTableRow.jsx',
  'app/src/components/labor/LaborControlDiarioPanel.jsx',
  'app/src/components/labor/LaborSabanaPanel.jsx',
  'app/src/components/resumenGerencial/ResumenMatrizOtsPanel.jsx',
  'app/src/components/resumenGerencial/ResumenOtDetailStrip.jsx',
  'app/src/components/resumenGerencial/ResumenHojaMaterialesPanel.jsx',
  'app/src/components/resumenGerencial/ResumenHojaHorasPanel.jsx',
  'app/src/components/resumenGerencial/ResumenHojaTercerosPanel.jsx',
  'app/src/components/resumenGerencial/BillingRightCostCard.jsx',
  'app/src/components/resumenGerencial/ComparadorNivel2OtTable.jsx',
]

const WORK_ITEMS_CUSTOM_SELECT_RE = /workItemsRepository\.listWorkItems\(\s*\{[\s\S]*?select:\s*['"]([^'"]+)['"]/g

export function checkCanonicalComponentsUsage(rootDir, appDir) {
  const srcRoot = path.join(appDir, 'src')
  if (!fs.existsSync(srcRoot)) return { errors: [], alerts: [] }

  const errors = []
  const alerts = []
  const stack = [srcRoot]

  while (stack.length > 0) {
    const dir = stack.pop()
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) { stack.push(full); continue }
      if (!CODE_EXT_RE.test(ent.name)) continue
      const rel = toPosix(path.relative(rootDir, full))
      if (rel.startsWith('app/src/components/canonical/')) continue

      const content = fs.readFileSync(full, 'utf8')
      if (RAW_MATERIAL_DATALIST_RE.test(content)) {
        if (LEGACY_MATERIAL_DATALIST_ALLOWLIST.has(rel)) {
          alerts.push(`Datalist legacy de materiales pendiente de migrar a CanonicalMaterialPicker: ${rel}`)
        } else {
          errors.push(`Prohibido crear datalist crudo de materiales fuera de CanonicalMaterialPicker: ${rel}`)
        }
      }

      if (rel.startsWith('app/src/services/') || rel.startsWith('app/src/lib/')) {
        for (const match of content.matchAll(WORK_ITEMS_CUSTOM_SELECT_RE)) {
          const cols = match[1].trim()
          if (cols === '*' || /^id(?:\s*,\s*work_order_id)?$/i.test(cols)) continue
          const missing = ['status', 'foreman_name'].filter((c) => !new RegExp(`\\b${c}\\b`).test(cols))
          if (missing.length > 0) {
            errors.push(`Consulta work_items incompleta en ${rel} (falta ${missing.join(', ')}): usar workItemsRepository.listCanonicalWorkItems()`)
          }
        }
      }
    }
  }

  for (const rel of REQUIRED_CANONICAL_OT_SURFACES) {
    const full = path.join(rootDir, rel)
    if (!fs.existsSync(full)) continue
    const content = fs.readFileSync(full, 'utf8')
    if (!content.includes('CanonicalOtBadge')) {
      errors.push(`Superficie obligatoria sin CanonicalOtBadge (tooltip de OT): ${rel}`)
    }
  }

  return { errors, alerts }
}

/**
 * Candado #4: Auditoría mecánica de `git diff HEAD -- app/src`.
 * Detecta líneas eliminadas (`-`) de alto riesgo funcional (columnas `<th`, aperturas `isOpen: true`,
 * tooltips de OT `formatWorkOrderTooltip` / `CanonicalOtBadge` y mutaciones `status:`) que no
 * aparecen restauradas en las líneas agregadas (`+`) del mismo archivo.
 */
const CRITICAL_DIFF_PATTERNS = [
  { label: 'encabezado de columna (<th>)', re: /<th\b/ },
  { label: 'apertura de modal (isOpen: true)', re: /\bisOpen\s*:\s*true\b/ },
  { label: 'tooltip flotante de OT', re: /\b(?:formatWorkOrderTooltip|formatWorkOrderTooltipCanonical|CanonicalOtBadge)\b/ },
  { label: 'transición de estado (status:)', re: /\bstatus\s*:\s*['"][A-Z_.\s?]+['"]/ },
]

export function analyzeGitDiffText(diffOut) {
  if (!diffOut || !diffOut.trim()) return []

  const perFile = new Map()
  let currentFile = null

  for (const line of diffOut.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6).trim()
      if (!perFile.has(currentFile)) perFile.set(currentFile, { removed: [], added: [] })
      continue
    }
    if (!currentFile || !CODE_EXT_RE.test(currentFile)) continue
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue
    if (line.startsWith('-')) perFile.get(currentFile).removed.push(line.slice(1))
    else if (line.startsWith('+')) perFile.get(currentFile).added.push(line.slice(1))
  }

  const alerts = []
  for (const [file, { removed, added }] of perFile.entries()) {
    const removedJoined = removed.join('\n')
    const addedJoined = added.join('\n')
    for (const pat of CRITICAL_DIFF_PATTERNS) {
      const removedHits = (removedJoined.match(new RegExp(pat.re.source, 'g')) || []).length
      const addedHits = (addedJoined.match(new RegExp(pat.re.source, 'g')) || []).length
      if (removedHits > addedHits) {
        alerts.push(
          `[REGRESIÓN DIFF] ${file}: se eliminaron ${removedHits - addedHits} ocurrencia(s) de ${pat.label} sin reemplazo equivalente`
        )
      }
    }
  }

  return alerts
}

export function checkGitDiffDroppedFeatures(rootDir) {
  let diffOut = ''
  try {
    diffOut = execFileSync('git', ['diff', 'HEAD', '--unified=0', '--', 'app/src'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return []
  }
  return analyzeGitDiffText(diffOut)
}
