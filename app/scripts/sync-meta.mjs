/**
 * sync-meta.mjs
 * CLI sgai-core para mantener sincronizado INDICE_METADATOS.md a 0 tokens.
 * Uso: node scripts/sync-meta.mjs [--check]
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMetaSync } from './lib/metaSyncEngine.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')
const checkOnly = process.argv.includes('--check')

const res = runMetaSync(ROOT_DIR, { checkOnly })
const status = res.changed ? (checkOnly ? 'PENDIENTE (--check)' : 'ACTUALIZADO') : 'OK'
console.log(
  `[sync:meta] +${res.added} agregadas | -${res.removed} huérfanas | ~${res.updated} fechas | ${res.indexRel} ${status}`
)

if (checkOnly && res.changed) {
  process.exit(1)
}
