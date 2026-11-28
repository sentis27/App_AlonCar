import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import {
  loadSmokeTargets,
  installWriteFuse,
  attachPageMonitors,
} from './e2eRuntime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

test.describe('sgai-core Smoke Engine Self-Test (Chromium real sin credenciales)', () => {
  test('renderiza /login con anclajes data-testid y cero errores de arranque', async ({ page }) => {
    const catalog = await loadSmokeTargets(ROOT_DIR)
    const monitors = attachPageMonitors(page)

    await page.goto('/login')
    await expect(page.locator(catalog.loginSelectors.page)).toBeVisible()
    await expect(page.locator(catalog.loginSelectors.email)).toBeVisible()
    await expect(page.locator(catalog.loginSelectors.password)).toBeVisible()
    await expect(page.locator(catalog.loginSelectors.submit)).toBeVisible()

    expect(monitors.pageErrors).toEqual([])
    expect(monitors.consoleErrors).toEqual([])
    expect(monitors.httpErrors).toEqual([])
  })

  test('Fusible Opción A bloquea escrituras POST/RPC en navegador sin falsos HTTP errors', async ({ page }) => {
    const fuse = await installWriteFuse(page, { allowWrites: false })
    const monitors = attachPageMonitors(page)

    await page.goto('/login')
    const probe = await page.evaluate(async () => {
      const r1 = await fetch('/rest/v1/smoke_probe', { method: 'POST', body: '{}' })
      const r2 = await fetch('/rpc/smoke_probe', { method: 'POST', body: '{}' })
      return {
        s1: r1.status,
        h1: r1.headers.get('x-sgai-write-fuse'),
        s2: r2.status,
        h2: r2.headers.get('x-sgai-write-fuse'),
      }
    })

    expect(probe).toEqual({ s1: 403, h1: 'blocked', s2: 403, h2: 'blocked' })
    expect(fuse.blockedWrites).toHaveLength(2)
    expect(monitors.httpErrors).toEqual([])
    expect(monitors.consoleErrors).toEqual([])
  })

  test('monitores detectan pageerror y console.error inyectados (prueba negativa)', async ({ page }) => {
    const monitors = attachPageMonitors(page)

    await page.goto('/login')
    await page.evaluate(() => {
      setTimeout(() => { throw new Error('SGAI_INJECTED_CRASH') }, 0)
      console.error('SGAI_INJECTED_CONSOLE_ERR')
    })

    await expect.poll(() => monitors.pageErrors.length).toBeGreaterThanOrEqual(1)
    expect(monitors.pageErrors.some((e) => e.includes('SGAI_INJECTED_CRASH'))).toBe(true)
    expect(monitors.consoleErrors.some((e) => e.includes('SGAI_INJECTED_CONSOLE_ERR'))).toBe(true)
  })
})
