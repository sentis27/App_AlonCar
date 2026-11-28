import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import {
  loadE2eEnv,
  loadSmokeTargets,
  installWriteFuse,
  attachPageMonitors,
  loginWithEmailPassword,
} from './e2eRuntime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

test.describe('sgai-core Smoke Catalog (barrera automática 0 tokens)', () => {
  test('recorre todas las rutas del catálogo sin errores JS, consola ni HTTP >= 400', async ({ page }) => {
    const env = loadE2eEnv(APP_DIR)
    const catalog = await loadSmokeTargets(ROOT_DIR)
    test.setTimeout(Math.max(120_000, catalog.targets.length * 4_000))

    const fuse = await installWriteFuse(page, { allowWrites: env.allowWrites })
    const monitors = attachPageMonitors(page)

    await loginWithEmailPassword(page, {
      email: env.email,
      password: env.password,
      loginSelectors: catalog.loginSelectors,
    })

    for (const target of catalog.targets) {
      monitors.reset()
      await page.goto(target.url)
      await page.locator(target.readySelector).first().waitFor({ state: 'visible', timeout: 15_000 })
      await page.waitForTimeout(300)

      const boundaryHits = await page.locator(catalog.errorBoundarySelector).count()
      expect(boundaryHits, `ErrorBoundary activo en ${target.url}`).toBe(0)
      expect(monitors.pageErrors, `pageerror en ${target.url}`).toEqual([])
      expect(monitors.consoleErrors, `console.error en ${target.url}`).toEqual([])
      expect(monitors.httpErrors, `HTTP >= 400 en ${target.url}`).toEqual([])
    }

    console.log(
      `[sgai-smoke] ${catalog.targets.length} vistas verificadas OK | Fusible A bloqueó ${fuse.blockedWrites.length} escritura(s)`
    )
  })
})
