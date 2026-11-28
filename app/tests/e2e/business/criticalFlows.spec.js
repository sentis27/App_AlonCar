import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import {
  loadE2eEnv,
  loadSmokeTargets,
  installWriteFuse,
  attachPageMonitors,
  loginWithEmailPassword,
} from '../core/e2eRuntime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

test.describe('AlonCar Critical Read-Only Flows (Email/Clave + Fusible A)', () => {
  test('autentica por email/clave, navega Menú Acordeón Pañol y opera buscador Zona 3', async ({ page }) => {
    const env = loadE2eEnv(APP_DIR)
    const catalog = await loadSmokeTargets(ROOT_DIR)
    const fuse = await installWriteFuse(page, { allowWrites: env.allowWrites })
    const monitors = attachPageMonitors(page)

    await loginWithEmailPassword(page, {
      email: env.email,
      password: env.password,
      loginSelectors: catalog.loginSelectors,
    })

    await expect(page.locator(catalog.loginSelectors.shell)).toBeVisible()
    await expect(page.locator(catalog.loginSelectors.sidebar)).toBeVisible()

    // Flujo 2: Navegación Menú Lateral Acordeón (FL-021)
    await page.locator('[data-testid="nav-module-panol"]').click()
    await page.locator('[data-testid="nav-tab-panol-catalogo"]').click()
    await expect(page).toHaveURL(/\/panol\?tab=catalogo/)
    await expect(page.locator(catalog.errorBoundarySelector)).toHaveCount(0)

    // Flujo 3: Buscador Zona 3 Canónica (FL-023)
    const searchInput = page.locator('[data-testid="zone3-search-input"]').first()
    await searchInput.waitFor({ state: 'visible', timeout: 15_000 })
    await searchInput.fill('TEST')
    await expect(searchInput).toHaveValue('TEST')
    await page.locator('[data-testid="zone3-search-clear"]').first().click()
    await expect(searchInput).toHaveValue('')

    expect(monitors.pageErrors).toEqual([])
    expect(monitors.consoleErrors).toEqual([])
    expect(monitors.httpErrors).toEqual([])
    expect(fuse.blockedWrites).toEqual([])
  })
})
