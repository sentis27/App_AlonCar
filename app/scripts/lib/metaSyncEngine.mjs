/**
 * metaSyncEngine.mjs
 * Motor genérico sgai-core para sincronización automática de INDICE_METADATOS.md a 0 tokens.
 * Agrega archivos .md nuevos, elimina filas huérfanas y actualiza fechas solo del delta git.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadHygieneConfig } from './hygieneConfig.mjs'

const toPosix = (p) => p.split(path.sep).join('/')

export function getTodayArIso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function walkActiveMarkdown(rootDir, docsCfg = {}, currentDir = rootDir, out = []) {
  const ignoreDirs = new Set(docsCfg.ignoreDirs || ['node_modules', 'dist', '.git'])
  const ignorePrefixes = docsCfg.ignoreRelPrefixes || []
  for (const ent of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (ignoreDirs.has(ent.name)) continue
    const full = path.join(currentDir, ent.name)
    const rel = toPosix(path.relative(rootDir, full))
    if (ignorePrefixes.some((p) => rel === p || rel.startsWith(`${p}/`))) continue
    if (ent.isDirectory()) walkActiveMarkdown(rootDir, docsCfg, full, out)
    else if (ent.name.endsWith('.md')) out.push(rel)
  }
  return out.sort()
}

export function inferMetadataRow(rel, todayIso) {
  const norm = toPosix(rel)
  const base = path.posix.basename(norm)
  const isSkill = base === 'SKILL.md' || norm.includes('/skills/')
  const row = (tipo, comp, lectura, estado = 'activo', dep = 'ninguno') => (
    [norm, tipo, comp, lectura, 'transversal', estado, todayIso, dep]
  )

  if (base === 'README.md') return row('guia', 'ninguno', 'primera-vez')
  if (norm.includes('/archivo/')) return row(isSkill ? 'skill' : 'registro', 'ignorar-en-auditoria', 'ignorar', 'archivado')
  if (isSkill) return row('skill', 'ninguno', 'primera-vez', 'activo', '.agents/skills/SKILLS_REGISTRY.md')
  if (/^DEC-\d+/i.test(base)) return row('decision', 'ninguno', 'cambios')
  if (/^ERR-\d+/i.test(base)) return row('error', 'auditar-reglas', 'completo')
  if (norm.includes('/estandares/')) return row('protocolo', 'auditar-reglas', 'completo')
  return row('documentacion-tecnica', 'ninguno', 'cambios')
}

function splitMarkdownCells(line) {
  const cells = []
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') { cur += '\\|'; i++; continue }
    if (line[i] === '|') { cells.push(cur.trim()); cur = ''; continue }
    cur += line[i]
  }
  cells.push(cur.trim())
  return cells.length >= 2 && cells[0] === '' && cells[cells.length - 1] === '' ? cells.slice(1, -1) : cells
}

const formatRow = (cells) => `| ${cells.join(' | ')} |`

export function syncMetadataIndexContent({
  rawContent,
  activeMdFiles,
  existingPathCheck,
  changedFiles = new Set(),
  todayIso = getTodayArIso(),
}) {
  const eol = rawContent.includes('\r\n') ? '\r\n' : '\n'
  const lines = rawContent.split(/\r?\n/)
  const headerIdx = lines.findIndex((l) => /^\|\s*Archivo\s*\|/i.test(l))
  if (headerIdx < 0 || headerIdx + 1 >= lines.length) {
    throw new Error('Formato inválido: no se encontró cabecera "| Archivo | ... |" en índice de metadatos')
  }

  const prefixLines = lines.slice(0, headerIdx + 2)
  const bodyLines = lines.slice(headerIdx + 2)
  const seen = new Set()
  const nextRows = []
  let removed = 0
  let updated = 0

  for (const line of bodyLines) {
    if (!line.trim().startsWith('|')) continue
    const cells = splitMarkdownCells(line)
    if (cells.length < 7 || !cells[0]) continue
    const filePath = cells[0]
    if (!existingPathCheck(filePath)) { removed++; continue }
    seen.add(filePath)
    if (changedFiles.has(filePath) && cells[6] !== todayIso) {
      cells[6] = todayIso
      updated++
    }
    nextRows.push(formatRow(cells))
  }

  let added = 0
  for (const rel of [...activeMdFiles].sort()) {
    if (seen.has(rel)) continue
    seen.add(rel)
    nextRows.push(formatRow(inferMetadataRow(rel, todayIso)))
    added++
  }

  const changed = added > 0 || removed > 0 || updated > 0
  const finalPrefix = prefixLines.map((line) => (
    changed && /^>\s*\*\*Última actualización:\*\*/i.test(line) ? `> **Última actualización:** ${todayIso}` : line
  ))
  const joined = [...finalPrefix, ...nextRows].join(eol) + (rawContent.endsWith('\n') ? eol : '')
  return { nextContent: joined, changed: changed && joined !== rawContent, added, removed, updated }
}

function getGitChangedFiles(rootDir) {
  const out = new Set()
  try {
    const raw = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      let rel = line.slice(3).trim()
      if (rel.includes(' -> ')) rel = rel.split(' -> ').pop().trim()
      out.add(toPosix(rel.replace(/^"|"$/g, '')))
    }
  } catch {
    // sin contexto git: sincroniza solo altas/bajas respecto al disco
  }
  return out
}

export function runMetaSync(rootDir, { checkOnly = false, config } = {}) {
  const cfg = config || loadHygieneConfig(rootDir)
  const docsCfg = cfg.docs || {}
  const indexRel = docsCfg.metadataIndexPath || 'INDICE_METADATOS.md'
  const indexPath = path.join(rootDir, indexRel)
  if (!fs.existsSync(indexPath)) throw new Error(`No existe ${indexRel} en ${rootDir}`)

  const rawContent = fs.readFileSync(indexPath, 'utf8')
  const changedFiles = getGitChangedFiles(rootDir)
  changedFiles.delete(indexRel)

  const res = syncMetadataIndexContent({
    rawContent,
    activeMdFiles: walkActiveMarkdown(rootDir, docsCfg),
    existingPathCheck: (rel) => fs.existsSync(path.join(rootDir, rel)),
    changedFiles,
    todayIso: getTodayArIso(),
  })

  if (!checkOnly && res.changed) fs.writeFileSync(indexPath, res.nextContent, 'utf8')
  return { indexRel, ...res }
}
