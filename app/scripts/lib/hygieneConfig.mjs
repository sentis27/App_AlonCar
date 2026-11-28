/**
 * hygieneConfig.mjs
 * Carga configuración específica del proyecto (hygiene.config.json) sobre valores
 * genéricos del motor sgai-core, manteniendo cero acoplamiento al dominio en el chasis.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '../../..')

export const DEFAULT_HYGIENE_CONFIG = {
  projectName: 'app',
  engineBrand: 'sgai-core',
  docs: {
    ignoreDirs: ['node_modules', 'dist', '.git'],
    ignoreRelPrefixes: ['app/dist'],
    forbiddenPathPatterns: ['file:///'],
    proseOnlyFiles: [],
    metadataIndexPath: 'INDICE_METADATOS.md',
    duplicateIdDirs: [],
    errorDocsDir: '',
    errorDocsStrictFromId: 1,
    liveDocSizeLimits: {
      maxBytes: 15 * 1024,
      files: [],
    },
    featuresLockPath: 'docs/FEATURES_LOCK.md',
  },
  migrations: {
    rollbackRequiredFrom: 1,
  },
  lineLimits: {
    rules: [
      { pattern: '^app/src/(?:schemas|repositories)/', limit: 200, label: 'schemas/repositories' },
      { pattern: '^app/src/(?:lib|hooks|services|pages)/', limit: 250, label: 'lib/hooks/services/pages' },
      { pattern: '^app/src/components/', limit: 300, label: 'components' },
    ],
    default: { limit: 300, label: 'app/src' },
  },
  repositoryBoundary: {
    allowedDirPrefix: 'app/src/repositories/',
  },
  canonicalDirPrefix: 'app/src/components/canonical/',
  dateTimePolicy: {
    enabled: false,
    canonicalModulePath: 'app/src/lib/dateTimeCanonical.js',
    ruleId: 'DATETIME',
  },
  prohibitedPatterns: [],
  customSelectGuards: [],
  spreadsheetTableRule: {
    enabled: false,
    ruleId: 'FL-027',
    enginePattern: '(?:useSpreadsheetGrid|useSheetSelection|useReadOnlySheetSelection|getColumnHeaderProps)',
    headerPattern: '(?:getColumnHeaderProps|getHeaderProps)',
    statusBarToken: 'GridStatusBarBottom',
    allowlist: [],
    parentOwnedStatusBar: [],
  },
  requiredSurfaces: {
    progressiveGrid: [],
    historyRange: [],
    batchedRepositories: [],
    groups: [],
  },
  diffGuardPatterns: [
    { label: 'encabezado de columna (<th>)', pattern: '<th\\b' },
    { label: 'apertura de modal (isOpen: true)', pattern: '\\bisOpen\\s*:\\s*true\\b' },
    { label: 'transición de estado (status:)', pattern: "\\bstatus\\s*:\\s*['\"][A-Z_.\\s?]+['\"]" },
  ],
  architectureBoundaries: {
    banLibUiImports: true,
    banDirectUiRepositoryImports: { enabled: true, allowlist: [] },
    banReactClassComponents: { enabled: true, allowlist: [] },
    banUnsafeOnBlur: { enabled: true, allowlist: [] },
    requireAuditInMutatingServices: { enabled: true, allowlist: [] },
    banCrossModuleComponentImports: {
      enabled: true,
      sharedComponentDirs: ['canonical'],
      allowedTargets: [],
      allowlist: [],
    },
  },
  where: {
    navigationCatalogPath: 'app/src/lib/navigationCatalog.js',
    moduleAliases: {},
  },
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(base, override) {
  if (!isPlainObject(override)) return base
  const out = { ...base }
  for (const [k, val] of Object.entries(override)) {
    if (isPlainObject(val) && isPlainObject(base[k])) {
      out[k] = deepMerge(base[k], val)
    } else if (val !== undefined) {
      out[k] = val
    }
  }
  return out
}

export function loadHygieneConfig(rootDir = DEFAULT_ROOT_DIR) {
  const base = rootDir || DEFAULT_ROOT_DIR
  const candidates = [
    path.join(base, 'app', 'scripts', 'hygiene.config.json'),
    path.join(base, 'scripts', 'hygiene.config.json'),
    path.join(base, 'hygiene.config.json'),
  ]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return deepMerge(DEFAULT_HYGIENE_CONFIG, parsed)
  }

  return deepMerge(DEFAULT_HYGIENE_CONFIG, {})
}
