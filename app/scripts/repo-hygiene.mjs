import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkMigrationsManifest } from './lib/migrationsManifest.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'Presentacion', '.git'])
const IGNORE_REL_PREFIXES = ['app/dist', 'docs/04_anexos_entendiemiento de planillas']
const USER_PATH_RE = /Users[\\/](?:senti|Vanoli)|file:\/\/\//i
const CODE_EXT_RE = /\.(?:js|jsx|ts|tsx)$/
const SRC_GUARDED_RE = /^app\/src\/(?:components|hooks|lib|repositories|schemas|services)\//
const SIZE_ALERT_BYTES = 15 * 1024
const SRC_LINE_LIMIT = 300

const args = new Set(process.argv.slice(2))
const FAST_MODE = args.has('--fast')
const STRICT_MODE = args.has('--strict')

const toPosix = (p) => p.split(path.sep).join('/')
const stripCode = (md) => md.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')

function walkMarkdown(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(ent.name)) continue
    const full = path.join(dir, ent.name)
    const rel = toPosix(path.relative(ROOT_DIR, full))
    if (IGNORE_REL_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`))) continue
    if (ent.isDirectory()) walkMarkdown(full, out)
    else if (ent.name.endsWith('.md')) out.push(rel)
  }
  return out.sort()
}

function checkDocsAndLinks(mdFiles) {
  const errors = []
  for (const rel of mdFiles) {
    const full = path.join(ROOT_DIR, rel)
    const raw = fs.readFileSync(full, 'utf8')
    const prose = rel === 'PLAN_OPTIMIZACION_IA.md' ? stripCode(raw) : raw

    if (USER_PATH_RE.test(prose)) {
      errors.push(`Ruta absoluta de usuario o file:/// prohibida en ${rel}`)
    }

    const linkable = stripCode(raw)
    const linkRe = /\[[^\]]*\]\(([^)]+)\)/g
    let match
    while ((match = linkRe.exec(linkable)) !== null) {
      const target = match[1].trim()
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue
      if (USER_PATH_RE.test(target) || /^file:/i.test(target)) {
        errors.push(`Link absoluto/file:/// prohibido en ${rel}: ${target}`)
        continue
      }
      const cleanPath = target.split('#')[0].split('?')[0]
      if (!cleanPath) continue
      let decoded = cleanPath
      try {
        decoded = decodeURIComponent(cleanPath)
      } catch {
        // usar ruta sin decodificar si contiene '%' literal
      }
      const resolved = path.resolve(path.dirname(full), decoded)
      if (!fs.existsSync(resolved)) {
        errors.push(`Link Markdown roto en ${rel} -> ${target}`)
      }
    }
  }
  return errors
}

function checkMetadataIndex(mdFiles) {
  const errors = []
  const indexPath = path.join(ROOT_DIR, 'INDICE_METADATOS.md')
  if (!fs.existsSync(indexPath)) {
    return ['Falta INDICE_METADATOS.md en la raíz del repositorio']
  }

  const indexed = new Set()
  const lines = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\|\s*([^|\s][^|]*?)\s*\|/)
    if (!m) continue
    const fileCol = m[1].trim()
    if (fileCol === 'Archivo' || fileCol.startsWith(':---')) continue
    indexed.add(fileCol)
  }

  for (const rel of mdFiles) {
    if (!indexed.has(rel)) {
      errors.push(`Archivo .md activo fuera de INDICE_METADATOS.md: ${rel}`)
    }
  }
  for (const rel of indexed) {
    if (!fs.existsSync(path.join(ROOT_DIR, rel))) {
      errors.push(`Entrada huérfana en INDICE_METADATOS.md (no existe en disco): ${rel}`)
    }
  }
  return errors
}

function checkDuplicateIds() {
  const errors = []
  const checks = [
    { dir: 'docs/02_producto/01_decisiones', re: /^(DEC-\d+)/i },
    { dir: 'docs/02_producto/02_errores', re: /^(ERR-\d+)/i },
  ]
  for (const { dir, re } of checks) {
    const fullDir = path.join(ROOT_DIR, dir)
    if (!fs.existsSync(fullDir)) continue
    const seen = new Map()
    for (const name of fs.readdirSync(fullDir)) {
      const m = name.match(re)
      if (!m) continue
      const id = m[1].toUpperCase()
      if (seen.has(id)) {
        errors.push(`ID duplicado ${id} en ${dir}: ${seen.get(id)} y ${name}`)
      } else {
        seen.set(id, name)
      }
    }
  }
  return errors
}

function checkLiveDocSizes() {
  const alerts = []
  const docs = [
    'TAREAS_PENDIENTES.md',
    'docs/02_producto/05_auditorias/BITACORA_DELTAS_SESION.md',
  ]
  for (const rel of docs) {
    const full = path.join(ROOT_DIR, rel)
    if (!fs.existsSync(full)) continue
    const bytes = fs.statSync(full).size
    if (bytes > SIZE_ALERT_BYTES) {
      alerts.push(
        `${rel} pesa ${(bytes / 1024).toFixed(1)} KB (> 15.0 KB) -> disparar rotación histórica`
      )
    }
  }
  return alerts
}

function countLines(text) {
  if (!text) return 0
  return text.split(/\r?\n/).length
}

function getHeadLineCount(rel) {
  try {
    const content = execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return countLines(content)
  } catch {
    return null
  }
}

function checkGitDiffLineLimits() {
  const alerts = []
  let statusOut = ''
  try {
    statusOut = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'app/src'], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    })
  } catch {
    return alerts
  }

  for (const rawLine of statusOut.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    const code = rawLine.slice(0, 2)
    if (code.includes('D')) continue
    let rel = rawLine.slice(3).trim()
    if (rel.includes(' -> ')) rel = rel.split(' -> ').pop().trim()
    rel = rel.replace(/^"|"$/g, '')
    if (!rel.startsWith('app/src/') || !CODE_EXT_RE.test(rel)) continue

    const full = path.join(ROOT_DIR, rel)
    if (!fs.existsSync(full)) continue
    const currentLines = countLines(fs.readFileSync(full, 'utf8'))
    const headLines = getHeadLineCount(rel)
    const scope = SRC_GUARDED_RE.test(rel) ? 'límite estricto' : 'app/src'

    if (headLines === null && currentLines > SRC_LINE_LIMIT) {
      alerts.push(`Archivo nuevo (${scope}) supera ${SRC_LINE_LIMIT} L: ${rel} (${currentLines} L)`)
    } else if (headLines !== null && headLines <= SRC_LINE_LIMIT && currentLines > SRC_LINE_LIMIT) {
      alerts.push(`Archivo (${scope}) cruzó ${SRC_LINE_LIMIT} L: ${rel} (${headLines} L -> ${currentLines} L)`)
    } else if (headLines !== null && headLines > SRC_LINE_LIMIT && currentLines > headLines) {
      alerts.push(`Archivo > ${SRC_LINE_LIMIT} L creció en diff: ${rel} (${headLines} L -> ${currentLines} L)`)
    }
  }
  return alerts
}

function runLocalBin(binName, binArgs) {
  const isWin = process.platform === 'win32'
  const bin = path.join(APP_DIR, 'node_modules', '.bin', isWin ? `${binName}.cmd` : binName)
  return spawnSync(isWin ? 'cmd.exe' : bin, isWin ? ['/d', '/c', bin, ...binArgs] : binArgs, {
    cwd: APP_DIR,
    encoding: 'utf8',
  })
}

const DIRECT_DB_ACCESS_RE = /\bsupabase\s*\.\s*(?:from|rpc)\s*\(|\.storage\s*\.\s*from\s*\(/

function stripCommentsForScan(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function checkRepositoryBoundary() {
  const srcRoot = path.join(APP_DIR, 'src')
  if (!fs.existsSync(srcRoot)) return []
  const errors = []
  const stack = [srcRoot]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) { stack.push(full); continue }
      if (!CODE_EXT_RE.test(ent.name)) continue
      const rel = toPosix(path.relative(ROOT_DIR, full))
      if (rel.startsWith('app/src/repositories/')) continue
      const content = stripCommentsForScan(fs.readFileSync(full, 'utf8'))
      if (DIRECT_DB_ACCESS_RE.test(content)) {
        errors.push(`Acceso directo a Supabase fuera de app/src/repositories/: ${rel}`)
      }
    }
  }
  return errors
}

function checkDatalistIntegrity() {
  const srcRoot = path.join(APP_DIR, 'src')
  if (!fs.existsSync(srcRoot)) return []
  const definedIds = new Set()
  const refs = []
  const stack = [srcRoot]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) { stack.push(full); continue }
      if (!CODE_EXT_RE.test(ent.name)) continue
      const content = fs.readFileSync(full, 'utf8')
      for (const m of content.matchAll(/<datalist\b[^>]*\bid=["']([^"']+)["']/g)) definedIds.add(m[1])
      for (const m of content.matchAll(/(?:\blist=["']([^"']+)["']|\blist:\s*["']([^"']+)["'])/g)) {
        const target = m[1] || m[2]
        if (target) refs.push({ rel: toPosix(path.relative(ROOT_DIR, full)), target })
      }
    }
  }
  const errors = []
  for (const r of refs) {
    if (!definedIds.has(r.target)) {
      errors.push(`Datalist huérfano en ${r.rel}: referencia list="${r.target}" sin <datalist id="${r.target}"> en app/src`)
    }
  }
  return errors
}

const ERR_VALID_STATES = new Set(['borrador', 'validado', 'superado'])

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  const fields = {}
  for (const line of m[1].split(/\r?\n/)) {
    const cleanLine = line.trim()
    if (!cleanLine || cleanLine.startsWith('#')) continue
    const kv = cleanLine.match(/^([a-z_]+)\s*:\s*(.+?)\s*$/i)
    if (kv) fields[kv[1].toLowerCase()] = kv[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')
  }
  return fields
}

function checkErrorDocsFormat() {
  const relDir = 'docs/02_producto/02_errores'
  const fullDir = path.join(ROOT_DIR, relDir)
  if (!fs.existsSync(fullDir)) return []
  const errors = []

  for (const name of fs.readdirSync(fullDir).sort()) {
    const m = name.match(/^(ERR-(\d+)).*\.md$/i)
    if (!m) continue
    const expectedId = m[1].toUpperCase()
    const idNum = Number(m[2])
    const rel = `${relDir}/${name}`
    const content = fs.readFileSync(path.join(fullDir, name), 'utf8')
    const fm = parseFrontmatter(content)

    if (!fm) {
      errors.push(`${rel}: falta bloque YAML frontmatter (--- ... ---)`)
      continue
    }
    if ((fm.id || '').toUpperCase() !== expectedId) errors.push(`${rel}: frontmatter id="${fm.id || ''}" debe ser "${expectedId}"`)
    if (fm.tipo !== 'error') errors.push(`${rel}: frontmatter tipo="${fm.tipo || ''}" debe ser "error"`)
    if (!ERR_VALID_STATES.has(fm.estado)) errors.push(`${rel}: estado="${fm.estado || ''}" inválido (usar borrador|validado|superado)`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.fecha || '')) errors.push(`${rel}: fecha="${fm.fecha || ''}" debe tener formato YYYY-MM-DD`)
    if (!/^#\s+\S/m.test(content)) errors.push(`${rel}: falta título H1 (# ...)`)

    const requiredSections = idNum >= 6
      ? [/^## Qué pasó \/ Dónde \/ Por qué(?:\s|$)/m, /^## Solución aplicada(?:\s|$)/m, /^## Regla anti-regresión(?:\s|\(|$)/m]
      : [/^## Qué pasó(?:\s|$)/m, /^## Por qué falló(?:\s|$)/m, /^## Solución (?:validada|aplicada)(?:\s|$)/m]
    for (const re of requiredSections) {
      if (!re.test(content)) errors.push(`${rel}: falta sección obligatoria ${re.source}`)
    }
  }
  return errors
}

function main() {
  const t0 = performance.now()
  const mdFiles = walkMarkdown(ROOT_DIR)

  const docErrors = checkDocsAndLinks(mdFiles)
  const indexErrors = checkMetadataIndex(mdFiles)
  const idErrors = checkDuplicateIds()
  const errFormatErrors = checkErrorDocsFormat()
  const datalistErrors = checkDatalistIntegrity()
  const repoBoundaryErrors = checkRepositoryBoundary()
  const migrations = checkMigrationsManifest(ROOT_DIR)
  const errors = [...docErrors, ...indexErrors, ...idErrors, ...errFormatErrors, ...datalistErrors, ...repoBoundaryErrors, ...migrations.errors]
  const alerts = [
    ...checkLiveDocSizes(),
    ...checkGitDiffLineLimits(),
  ]

  let lintSummary = 'omitido (--fast)'
  let buildSummary = 'omitido (--fast)'
  let testSummary = 'omitido (--fast)'

  if (!FAST_MODE) {
    const lintRes = runLocalBin('oxlint', ['--quiet'])
    const lintOut = `${lintRes.stdout || ''}\n${lintRes.stderr || ''}`.trim()
    const summaryLine = lintOut.split(/\r?\n/).find((l) => /Found\s+\d+\s+warnings?\s+and\s+\d+\s+errors?/i.test(l))
    lintSummary = summaryLine ? summaryLine.trim() : `exit ${lintRes.status ?? 1}`
    if (lintRes.status !== 0) {
      errors.push(`oxlint falló (${lintSummary}):\n${lintOut}`)
    }

    const buildRes = runLocalBin('vite', ['build'])
    const buildOut = `${buildRes.stdout || ''}\n${buildRes.stderr || ''}`.trim()
    const builtLine = buildOut.split(/\r?\n/).find((l) => /built in/i.test(l))
    buildSummary = builtLine ? builtLine.trim() : `exit ${buildRes.status ?? 1}`
    if (buildRes.status !== 0) {
      errors.push(`vite build falló:\n${buildOut}`)
    }

    const testRes = runLocalBin('vitest', ['run'])
    const testOut = `${testRes.stdout || ''}\n${testRes.stderr || ''}`.trim()
    const testLine = testOut.split(/\r?\n/).find((l) => /Tests\s+\d+\s+passed/i.test(l))
    testSummary = testLine ? testLine.trim() : `exit ${testRes.status ?? 1}`
    if (testRes.status !== 0) {
      errors.push(`vitest falló (${testSummary}):\n${testOut}`)
    }
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2)
  console.log(
    `[check:hygiene] .md activos: ${mdFiles.length} | docs/links: ${docErrors.length === 0 ? 'OK' : `FAIL (${docErrors.length})`} | INDICE_METADATOS: ${indexErrors.length === 0 ? 'OK' : `FAIL (${indexErrors.length})`} | IDs DEC/ERR: ${idErrors.length === 0 ? 'OK' : `FAIL (${idErrors.length})`} | ERR formato: ${errFormatErrors.length === 0 ? 'OK' : `FAIL (${errFormatErrors.length})`} | datalists: ${datalistErrors.length === 0 ? 'OK' : `FAIL (${datalistErrors.length})`}`
  )
  console.log(`[check:hygiene] repo boundary: ${repoBoundaryErrors.length === 0 ? 'OK (0 bypass)' : `FAIL (${repoBoundaryErrors.length})`}`)
  console.log(`[check:hygiene] oxlint: ${lintSummary}`)
  console.log(`[check:hygiene] migraciones: ${migrations.migrationsCount} (max ${String(migrations.maxNumber).padStart(4, '0')}) | rollbacks: ${migrations.rollbacksCount} | ${migrations.errors.length === 0 ? 'OK' : `FAIL (${migrations.errors.length})`}`)
  console.log(`[check:hygiene] vite build: ${buildSummary}`)
  console.log(`[check:hygiene] vitest: ${testSummary}`)

  if (alerts.length > 0) {
    console.warn(`[check:hygiene] ALERTAS (${alerts.length}):`)
    for (const a of alerts) console.warn(`  - [ALERTA] ${a}`)
  }

  if (errors.length > 0) {
    console.error(`[check:hygiene] ERRORES (${errors.length}):`)
    for (const e of errors) console.error(`  - [ERROR] ${e}`)
    process.exit(1)
  }

  if (STRICT_MODE && alerts.length > 0) {
    console.error(`[check:hygiene] Modo --strict: ${alerts.length} alerta(s) bloqueante(s).`)
    process.exit(1)
  }

  console.log(`[check:hygiene] OK (${elapsed}s)`)
}

main()
