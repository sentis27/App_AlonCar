/**
 * antiRegressionChecks.mjs
 * Motor genérico sgai-core de guardias anti-regresión (Candados #1, #2, #3 y #4).
 * Lee reglas y superficies desde hygiene.config.json sin acoplarse al proyecto.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadHygieneConfig } from './hygieneConfig.mjs'

const CODE_EXT_RE = /\.(?:js|jsx|ts|tsx)$/
const toPosix = (p) => p.split(path.sep).join('/')

const RAW_UTC_TODAY_RE = /\bnew\s+Date\(\)\.toISOString\(\)\.(?:split\(['"]T['"]\)\[0\]|slice\(\s*0\s*,\s*10\s*\))/
const RAW_UNANCHORED_DATE_LOCALE_RE = /\bnew\s+Date\([^)]*\)\.toLocale(?:Date|Time)?String\(/

export function getPathLineLimit(rel, config) {
  const cfg = config || loadHygieneConfig()
  const rules = cfg.lineLimits?.rules || []
  for (const rule of rules) {
    if (new RegExp(rule.pattern).test(rel)) {
      return { limit: rule.limit, label: rule.label }
    }
  }
  const fallback = cfg.lineLimits?.default || { limit: 300, label: 'app/src' }
  return { limit: fallback.limit, label: fallback.label }
}

export function checkFeaturesLockManifest(rootDir, config) {
  const cfg = config || loadHygieneConfig(rootDir)
  const rel = cfg.docs?.featuresLockPath || 'docs/FEATURES_LOCK.md'
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

function checkMissingTokens(rootDir, pathsList, tokens, formatMessage, errors) {
  for (const rel of pathsList) {
    const full = path.join(rootDir, rel)
    if (!fs.existsSync(full)) continue
    const content = fs.readFileSync(full, 'utf8')
    if (tokens.some((tok) => !content.includes(tok))) {
      errors.push(formatMessage(rel))
    }
  }
}

export function checkCanonicalComponentsUsage(rootDir, appDir, config) {
  const cfg = config || loadHygieneConfig(rootDir)
  const srcRoot = path.join(appDir, 'src')
  if (!fs.existsSync(srcRoot)) return { errors: [], alerts: [] }

  const errors = []
  const alerts = []
  const canonicalPrefix = cfg.canonicalDirPrefix || 'app/src/components/canonical/'
  const datePolicy = cfg.dateTimePolicy || {}
  const prohibited = (cfg.prohibitedPatterns || []).map((p) => ({
    ...p,
    re: new RegExp(p.pattern, p.flags || ''),
    legacyAllowlist: new Set(p.legacyAllowlist || []),
  }))
  const selectGuards = (cfg.customSelectGuards || []).map((g) => ({
    ...g,
    callRe: new RegExp(g.callPattern, 'g'),
    ignoreRe: g.ignoreSelectPattern ? new RegExp(g.ignoreSelectPattern, 'i') : null,
  }))
  const sheetRule = cfg.spreadsheetTableRule || {}
  const NON_SPREADSHEET_TABLE_ALLOWLIST = new Set(sheetRule.allowlist || [])
  const parentOwnedBars = new Set(sheetRule.parentOwnedStatusBar || [])
  const engineRe = new RegExp(sheetRule.enginePattern || '(?:useSpreadsheetGrid|useSheetSelection)')
  const headerRe = new RegExp(sheetRule.headerPattern || '(?:getColumnHeaderProps|getHeaderProps)')
  const statusBarTok = sheetRule.statusBarToken || 'GridStatusBarBottom'
  const sheetRuleId = sheetRule.ruleId || 'FL-027'

  const stack = [srcRoot]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) { stack.push(full); continue }
      if (!CODE_EXT_RE.test(ent.name)) continue
      const rel = toPosix(path.relative(rootDir, full))
      if (rel.startsWith(canonicalPrefix)) continue

      const content = fs.readFileSync(full, 'utf8')
      if (datePolicy.enabled && rel !== datePolicy.canonicalModulePath) {
        if (RAW_UTC_TODAY_RE.test(content)) {
          errors.push(`Prohibido usar new Date().toISOString().split('T')[0]/slice(0,10) (bug UTC-3 tras 21:00 ART); usar getTodayArIso() de ${path.posix.basename(datePolicy.canonicalModulePath || 'dateTimeCanonical.js')} (${datePolicy.ruleId || 'FL-024'}): ${rel}`)
        }
        if (RAW_UNANCHORED_DATE_LOCALE_RE.test(content)) {
          errors.push(`Prohibido usar new Date().toLocale*String() sin huso horario local; usar formatDateAr/formatDateTimeAr/formatTimeAr (${datePolicy.ruleId || 'FL-024'}): ${rel}`)
        }
      }

      for (const pat of prohibited) {
        if (!pat.re.test(content)) continue
        if (pat.legacyAllowlist.has(rel)) alerts.push(`${pat.legacyMessage || pat.message}: ${rel}`)
        else errors.push(`${pat.message}: ${rel}`)
      }

      for (const guard of selectGuards) {
        if (guard.onlyPrefixes?.length && !guard.onlyPrefixes.some((p) => rel.startsWith(p))) continue
        for (const match of content.matchAll(guard.callRe)) {
          const cols = (match[1] || '').trim()
          if (guard.ignoreRe && guard.ignoreRe.test(cols)) continue
          const missing = (guard.requiredColumns || []).filter((c) => !new RegExp(`\\b${c}\\b`).test(cols))
          if (missing.length > 0) {
            errors.push(`${guard.label} en ${rel} (falta ${missing.join(', ')}): ${guard.recommendation}`)
          }
        }
      }

      if (sheetRule.enabled && (rel.startsWith('app/src/components/') || rel.startsWith('app/src/pages/')) && /<table\b/.test(content) && !NON_SPREADSHEET_TABLE_ALLOWLIST.has(rel)) {
        const hasEngine = engineRe.test(content)
        const hasHeaders = headerRe.test(content)
        const hasStatusBar = parentOwnedBars.has(rel) || content.includes(statusBarTok)
        if (!hasEngine || !hasHeaders || !hasStatusBar) {
          const missing = [!hasEngine && 'useSheetSelection/useSpreadsheetGrid', !hasHeaders && 'getHeaderProps/getColumnHeaderProps', !hasStatusBar && statusBarTok].filter(Boolean).join(', ')
          errors.push(`Planilla sin Motor General Excel/Sheets (${sheetRuleId} · falta ${missing}): ${rel}`)
        }
      }
    }
  }

  for (const group of cfg.requiredSurfaces?.groups || []) {
    checkMissingTokens(rootDir, group.paths || [], group.requiredTokens || [], (rel) => `${group.message}: ${rel}`, errors)
  }

  const REQUIRED_PROGRESSIVE_GRID_SURFACES = cfg.requiredSurfaces?.progressiveGrid || []
  const REQUIRED_HISTORY_RANGE_SURFACES = cfg.requiredSurfaces?.historyRange || []
  const REQUIRED_BATCHED_REPOSITORIES = cfg.requiredSurfaces?.batchedRepositories || []

  checkMissingTokens(rootDir, REQUIRED_PROGRESSIVE_GRID_SURFACES, ['useProgressiveRows', 'CanonicalProgressiveTableFooter'], (rel) => `Grilla de alto volumen sin render progresivo canónico: ${rel}`, errors)
  checkMissingTokens(rootDir, REQUIRED_HISTORY_RANGE_SURFACES, ['CanonicalHistoryRangeSelect'], (rel) => `Módulo diario sin selector de ventana histórica CanonicalHistoryRangeSelect: ${rel}`, errors)
  checkMissingTokens(rootDir, REQUIRED_BATCHED_REPOSITORIES, ['findAllBatched'], (rel) => `Repositorio crítico sin paginación por lotes findAllBatched: ${rel}`, errors)

  return { errors, alerts }
}

export function analyzeGitDiffText(diffOut, config) {
  if (!diffOut || !diffOut.trim()) return []
  const cfg = config || loadHygieneConfig()
  const patterns = (cfg.diffGuardPatterns || []).map((p) => ({
    label: p.label,
    re: new RegExp(p.pattern, p.flags || ''),
  }))

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
    for (const pat of patterns) {
      const removedHits = (removedJoined.match(new RegExp(pat.re.source, 'g')) || []).length
      const addedHits = (addedJoined.match(new RegExp(pat.re.source, 'g')) || []).length
      if (removedHits > addedHits) {
        alerts.push(`[REGRESIÓN DIFF] ${file}: se eliminaron ${removedHits - addedHits} ocurrencia(s) de ${pat.label} sin reemplazo equivalente`)
      }
    }
  }
  return alerts
}

export function checkGitDiffDroppedFeatures(rootDir, config) {
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
  return analyzeGitDiffText(diffOut, config || loadHygieneConfig(rootDir))
}
