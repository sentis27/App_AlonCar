/**
 * whereEngine.mjs
 * Motor genérico sgai-core del Feature Map consultable (`where.mjs`).
 * Lee NAVIGATION_MODULES, archivos por capa y FEATURES_LOCK a ~150 tokens por consulta.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadHygieneConfig } from './hygieneConfig.mjs'

const LAYER_DIRS = ['pages', 'components', 'hooks', 'services', 'repositories', 'schemas']
const CODE_EXT_RE = /\.(?:js|jsx|ts|tsx)$/
const toPosix = (p) => p.split(path.sep).join('/')

export function normalizeQuery(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function parseFeaturesLockRows(rawMarkdown) {
  const rows = []
  for (const line of String(rawMarkdown || '').split(/\r?\n/)) {
    const m = line.match(/^\|\s*(FL-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(blindado|pendiente_fix)\s*\|/)
    if (m) rows.push({ id: m[1].trim(), module: m[2].trim(), summary: m[3].trim(), surface: m[4].trim().replace(/^`|`$/g, ''), status: m[5].trim() })
  }
  return rows
}

export function collectProjectSourceFiles(rootDir) {
  const out = []
  for (const layer of LAYER_DIRS) {
    const baseDir = path.join(rootDir, 'app', 'src', layer)
    if (!fs.existsSync(baseDir)) continue
    const stack = [baseDir]
    while (stack.length > 0) {
      const dir = stack.pop()
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) stack.push(full)
        else if (CODE_EXT_RE.test(ent.name)) out.push(toPosix(path.relative(rootDir, full)))
      }
    }
  }
  return out.sort()
}

function matchModule(mod, qNorm, aliases) {
  const modId = normalizeQuery(mod.id)
  const modPath = normalizeQuery(mod.path)
  const modName = normalizeQuery(mod.name)
  const modPerm = normalizeQuery(mod.permissionKey)
  const children = Array.isArray(mod.children) ? mod.children : []

  const exactChild = children.find((c) => normalizeQuery(c.permissionKey) === qNorm || normalizeQuery(`${mod.id}.${c.id}`) === qNorm)
  if (modId === qNorm || modPath === `/${qNorm}` || modPerm === qNorm || exactChild) {
    return { score: 3, matchedChildId: exactChild?.id || null }
  }
  if (aliases.some((a) => normalizeQuery(a) === qNorm)) return { score: 2, matchedChildId: null }

  const childHit = children.find((c) => [c.id, c.label, c.shortLabel, c.permissionKey].some((f) => normalizeQuery(f).includes(qNorm)))
  const modHit = [modId, modName, modPath, modPerm, ...Object.keys(mod.tabAliases || {}), ...aliases].some((f) => normalizeQuery(f).includes(qNorm))
  return childHit || modHit ? { score: 1, matchedChildId: childHit?.id || null } : { score: 0, matchedChildId: null }
}

function groupFilesByLayer(mod, sourceFiles, aliases) {
  const tokens = [...new Set([mod.id, ...aliases].map(normalizeQuery).filter((t) => t.length >= 3))]
  const grouped = new Map(LAYER_DIRS.map((l) => [l, []]))
  const matchedSet = new Set()
  for (const rel of sourceFiles) {
    const parts = rel.split('/')
    const layer = parts[2]
    if (!grouped.has(layer)) continue
    const subPath = normalizeQuery(parts.slice(3).join('/'))
    if (tokens.some((tok) => subPath.includes(tok))) {
      grouped.get(layer).push(parts.slice(3).join('/'))
      matchedSet.add(rel)
    }
  }
  return { grouped, matchedSet }
}

function formatModuleBlock({ mod, matchedChildId, sourceFiles, lockRows, aliases }) {
  const children = Array.isArray(mod.children) ? mod.children : []
  const tabsText = children.length === 0
    ? '  (sin submódulos)'
    : children.map((c) => ` ${c.id === matchedChildId ? '*' : ' '}${c.id} -> ${c.shortLabel || c.label} [${c.permissionKey || c.id}]`).join('\n')

  const { grouped, matchedSet } = groupFilesByLayer(mod, sourceFiles, aliases)
  const layerLines = LAYER_DIRS.map((layer) => {
    const files = grouped.get(layer) || []
    if (files.length === 0) return null
    return `  ${layer}: ${files.slice(0, 4).join(', ')}${files.length > 4 ? ` (+${files.length - 4} más)` : ''}`
  }).filter(Boolean)

  const modNorm = normalizeQuery(mod.id)
  const nameNorm = normalizeQuery(mod.name.split(' ')[0])
  const modLocks = lockRows.filter((r) => {
    const rm = normalizeQuery(r.module)
    return !rm.startsWith('transversal') && (rm.includes(modNorm) || (nameNorm.length >= 4 && rm.includes(nameNorm)) || matchedSet.has(r.surface))
  })
  const transversalCount = lockRows.filter((r) => normalizeQuery(r.module).startsWith('transversal')).length
  const flLine = modLocks.length > 0
    ? `FL módulo: ${modLocks.map((r) => `${r.id}(${r.status})`).join(', ')} | Transversales: ${transversalCount}`
    : `FL módulo: ninguno específico | Transversales: ${transversalCount}`

  return [
    `[where] ${mod.name} (${mod.id})`,
    `Ruta: ${mod.path} | Arquetipo: ${mod.archetype || 'N/A'} | Permiso: ${mod.permissionKey || mod.id} | Default: ${mod.defaultTab || '-'}`,
    `Submódulos (?tab=):\n${tabsText}`,
    `Archivos (app/src/<capa>/):\n${layerLines.length ? layerLines.join('\n') : '  (sin coincidencias por alias)'}`,
    flLine,
  ].join('\n')
}

export function buildWhereReport({ query, modules, sourceFiles = [], lockRows = [], config }) {
  const cfg = config || loadHygieneConfig()
  const aliasesByMod = cfg.where?.moduleAliases || {}
  const qRaw = String(query || '').trim()

  if (!qRaw || qRaw === '--list') {
    const lines = [`[where] Módulos (${modules.length}):`]
    for (const m of modules) lines.push(`- ${m.id} | ${m.path} | ${m.archetype || '-'} | tabs: ${(m.children || []).map((c) => c.id).join(', ') || '-'}`)
    return { found: true, text: lines.join('\n') }
  }

  if (/^FL-\d+$/i.test(qRaw)) {
    const id = qRaw.toUpperCase()
    const row = lockRows.find((r) => r.id.toUpperCase() === id)
    if (!row) return { found: false, text: `[where] Contrato ${id} no encontrado en manifiesto.` }
    return { found: true, text: `[where] ${row.id} (${row.status}) · Módulo: ${row.module}\nSuperficie: ${row.surface}\nContrato: ${row.summary}` }
  }

  const qNorm = normalizeQuery(qRaw)
  const scored = modules
    .map((mod) => ({ mod, ...matchModule(mod, qNorm, aliasesByMod[mod.id] || []) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { found: false, text: `[where] Sin coincidencias para "${qRaw}". Usá --list para ver módulos.` }

  const topScore = scored[0].score
  const selected = (topScore >= 2 ? scored.filter((s) => s.score === topScore) : scored).slice(0, 3)
  const blocks = selected.map((s) => formatModuleBlock({
    mod: s.mod,
    matchedChildId: s.matchedChildId,
    sourceFiles,
    lockRows,
    aliases: aliasesByMod[s.mod.id] || [],
  }))
  return { found: true, text: blocks.join('\n---\n') }
}

export async function runWhereQuery(rootDir, query, config) {
  const cfg = config || loadHygieneConfig(rootDir)
  const navRel = cfg.where?.navigationCatalogPath || 'app/src/lib/navigationCatalog.js'
  const navFull = path.join(rootDir, navRel)
  if (!fs.existsSync(navFull)) throw new Error(`No existe catálogo de navegación: ${navRel}`)

  const mod = await import(pathToFileURL(navFull).href)
  const lockFull = path.join(rootDir, cfg.docs?.featuresLockPath || 'docs/FEATURES_LOCK.md')
  const lockRows = fs.existsSync(lockFull) ? parseFeaturesLockRows(fs.readFileSync(lockFull, 'utf8')) : []
  return buildWhereReport({ query, modules: mod.NAVIGATION_MODULES || [], sourceFiles: collectProjectSourceFiles(rootDir), lockRows, config: cfg })
}
