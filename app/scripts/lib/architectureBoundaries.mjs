/**
 * architectureBoundaries.mjs
 * Guardrails genéricos de arquitectura por capas, límites entre módulos y patrones seguros.
 * Cero acoplamiento a nombres de dominio o rutas específicas del proyecto.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadHygieneConfig } from './hygieneConfig.mjs'

const CODE_EXT_RE = /\.(?:js|jsx|ts|tsx)$/
const IMPORT_RE = /\bimport\s+(?:[^;]*?\bfrom\s+)?['"]([^'"]+)['"]/g
const LIB_UI_IMPORT_RE = /^(?:react|react-dom)(?:\/|$)|(?:^|\/)components(?:\/|$)/
const REPO_IMPORT_RE = /(?:^|\/)repositories(?:\/|$)/
const CLASS_COMP_RE = /\bextends\s+(?:React\.)?(?:Pure)?Component\b/
const ONBLUR_IDENT_RE = /onBlur=\{\s*([a-zA-Z_$][\w$.]*)\s*\}/g
const SAFE_ONBLUR_IDENTS = new Set(['undefined', 'null', 'onBlur', 'props.onBlur'])
const SERVICE_MUTATION_RE = /\.(?:create|update|remove|delete|upsert|insert|save|patch|bulk|updateById|deleteById|upsertBy)\w*\s*\(/
const AUDIT_TOKEN_RE = /\b(?:auditService|logCellChange|logRowAction|logBatchPaste)\b/

const toPosix = (p) => p.split(path.sep).join('/')

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function normalizeRule(rule, defaultEnabled = true) {
  if (typeof rule === 'boolean') return { enabled: rule, allowlist: new Set() }
  if (!rule || typeof rule !== 'object') return { enabled: defaultEnabled, allowlist: new Set() }
  return {
    ...rule,
    enabled: rule.enabled ?? defaultEnabled,
    allowlist: new Set(rule.allowlist || []),
  }
}

function extractImports(strippedCode) {
  const imports = []
  for (const m of strippedCode.matchAll(IMPORT_RE)) {
    if (m[1]) imports.push(m[1])
  }
  return imports
}

function checkSingleFile(rel, stripped, rules, errors) {
  const imports = extractImports(stripped)

  if (rules.libUi.enabled && rel.startsWith('app/src/lib/') && !rules.libUi.allowlist.has(rel)) {
    for (const imp of imports) {
      if (LIB_UI_IMPORT_RE.test(imp)) {
        errors.push(`[ARCH] app/src/lib/ no debe importar React ni componentes UI: ${rel} (${imp})`)
      }
    }
  }

  const isUiFile = rel.startsWith('app/src/components/') || rel.startsWith('app/src/pages/')
  if (rules.uiRepo.enabled && isUiFile && !rules.uiRepo.allowlist.has(rel)) {
    for (const imp of imports) {
      if (REPO_IMPORT_RE.test(imp)) {
        errors.push(`[ARCH] UI no debe importar repositories/ directamente (usar services/): ${rel} (${imp})`)
      }
    }
  }

  if (rules.classComp.enabled && rel.startsWith('app/src/') && !rules.classComp.allowlist.has(rel)) {
    if (CLASS_COMP_RE.test(stripped)) {
      errors.push(`[ARCH] Prohibido declarar componentes de clase en React (usar funciones/hooks): ${rel}`)
    }
  }

  if (rules.onBlur.enabled && rel.startsWith('app/src/') && !rules.onBlur.allowlist.has(rel)) {
    for (const m of stripped.matchAll(ONBLUR_IDENT_RE)) {
      const ident = m[1]
      if (!SAFE_ONBLUR_IDENTS.has(ident)) {
        errors.push(`[ARCH] onBlur={${ident}} pasa evento sintético; usar onBlur={() => ...}: ${rel}`)
      }
    }
  }

  if (rules.serviceAudit.enabled && rel.startsWith('app/src/services/') && !rules.serviceAudit.allowlist.has(rel)) {
    if (SERVICE_MUTATION_RE.test(stripped) && !AUDIT_TOKEN_RE.test(stripped)) {
      errors.push(`[ARCH] Servicio con mutación sin trazabilidad auditService: ${rel}`)
    }
  }

  if (rules.crossModule.enabled && rel.startsWith('app/src/components/') && !rules.crossModule.allowlist.has(rel)) {
    const parts = rel.slice('app/src/components/'.length).split('/')
    const myMod = parts.length >= 2 ? parts[0] : null
    if (myMod && !rules.sharedDirs.has(myMod)) {
      for (const imp of imports) {
        if (!imp.startsWith('.')) continue
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), imp))
        if (!resolved.startsWith('app/src/components/')) continue
        const targetParts = resolved.slice('app/src/components/'.length).split('/')
        const targetMod = targetParts.length >= 2 ? targetParts[0] : null
        const resolvedNoExt = resolved.replace(CODE_EXT_RE, '')
        if (
          targetMod &&
          targetMod !== myMod &&
          !rules.sharedDirs.has(targetMod) &&
          !rules.allowedTargets.has(resolved) &&
          !rules.allowedTargets.has(resolvedNoExt)
        ) {
          errors.push(`[ARCH] Import cruzado entre módulos UI (${myMod} -> ${targetMod}): ${rel} importa ${resolved}`)
        }
      }
    }
  }
}

export function analyzeSourceArchitectureBoundaries(files, config) {
  const cfg = config || loadHygieneConfig()
  const bounds = cfg.architectureBoundaries || {}
  const crossRaw = bounds.banCrossModuleComponentImports
  const rules = {
    libUi: normalizeRule(bounds.banLibUiImports, true),
    uiRepo: normalizeRule(bounds.banDirectUiRepositoryImports, true),
    classComp: normalizeRule(bounds.banReactClassComponents, true),
    onBlur: normalizeRule(bounds.banUnsafeOnBlur, true),
    serviceAudit: normalizeRule(bounds.requireAuditInMutatingServices, true),
    crossModule: normalizeRule(crossRaw, true),
    sharedDirs: new Set(crossRaw?.sharedComponentDirs || ['canonical']),
    allowedTargets: new Set(crossRaw?.allowedTargets || []),
  }

  const errors = []
  for (const file of files || []) {
    const rel = toPosix(file.rel || '')
    if (!CODE_EXT_RE.test(rel)) continue
    checkSingleFile(rel, stripComments(file.content || ''), rules, errors)
  }
  return errors
}

function collectSourceFiles(rootDir, appDir) {
  const srcRoot = path.join(appDir, 'src')
  if (!fs.existsSync(srcRoot)) return []
  const out = []
  const stack = [srcRoot]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!CODE_EXT_RE.test(ent.name)) continue
      out.push({
        rel: toPosix(path.relative(rootDir, full)),
        content: fs.readFileSync(full, 'utf8'),
      })
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

export function checkArchitectureBoundaries(rootDir, appDir, config) {
  const cfg = config || loadHygieneConfig(rootDir)
  const files = collectSourceFiles(rootDir, appDir)
  return analyzeSourceArchitectureBoundaries(files, cfg)
}
