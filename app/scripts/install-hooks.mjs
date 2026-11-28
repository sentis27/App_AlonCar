/**
 * install-hooks.mjs
 * Configura core.hooksPath = .githooks en el repositorio Git local.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
})

console.log('[sgai-core] Git hooks activados: core.hooksPath = .githooks')
