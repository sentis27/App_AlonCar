/**
 * where.mjs
 * CLI sgai-core para consultar módulos, ?tab=, archivos por capa y FL-* en ~150 tokens.
 * Uso: node scripts/where.mjs [--list | <modulo> | <modulo.tab> | FL-NNN]
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWhereQuery } from './lib/whereEngine.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')
const query = process.argv.slice(2).join(' ').trim()

const res = await runWhereQuery(ROOT_DIR, query)
console.log(res.text)
if (!res.found) process.exit(1)
