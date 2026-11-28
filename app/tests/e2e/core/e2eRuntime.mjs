/**
 * e2eRuntime.mjs
 * Motor genérico sgai-core para Playwright Smoke y E2E:
 * carga .env.e2e.local, construye rutas desde navigationCatalog + featureMap,
 * aplica Fusible Opción A (cero escrituras en Supabase) y monitorea errores JS/consola/HTTP.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadHygieneConfig } from '../../../scripts/lib/hygieneConfig.mjs'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function parseEnvText(raw) {
  const out = {}
  for (const rawLine of String(raw || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    const key = line.slice(0, eqIdx).trim()
    let val = line.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

export function loadE2eEnv(appDir) {
  const localPath = path.join(appDir, '.env.e2e.local')
  const fileEnv = fs.existsSync(localPath) ? parseEnvText(fs.readFileSync(localPath, 'utf8')) : {}
  const getVal = (key) => {
    const fromProc = process.env[key]
    if (fromProc !== undefined && String(fromProc).trim() !== '') return String(fromProc).trim()
    return String(fileEnv[key] || '').trim()
  }

  const email = getVal('E2E_EMAIL')
  const password = getVal('E2E_PASSWORD')
  return {
    baseUrl: getVal('E2E_BASE_URL') || 'http://127.0.0.1:5173',
    email,
    password,
    allowWrites: getVal('E2E_ALLOW_WRITES').toLowerCase() === 'true',
    browserChannel: getVal('E2E_BROWSER_CHANNEL') || undefined,
    hasCredentials: Boolean(email && password),
  }
}

export function isMutatingApiRequest(method, urlStr) {
  const m = String(method || '').toUpperCase()
  if (!MUTATING_METHODS.has(m)) return false
  const url = String(urlStr || '')
  if (/\/auth\/v1\//i.test(url)) return false
  return /\/(?:rest|storage|functions)\/v1\//i.test(url) || /\/rpc\//i.test(url)
}

export async function loadSmokeTargets(rootDir) {
  const config = loadHygieneConfig(rootDir)
  const navRel = config.where?.navigationCatalogPath || 'app/src/lib/navigationCatalog.js'
  const fmRel = config.featureMap?.configPath || 'app/scripts/featureMap.config.json'
  const navMod = await import(pathToFileURL(path.join(rootDir, navRel)).href)
  const featureMap = JSON.parse(fs.readFileSync(path.join(rootDir, fmRel), 'utf8'))
  const modules = navMod.NAVIGATION_MODULES || []
  const targets = []

  for (const mod of modules) {
    const modCfg = featureMap.modules?.[mod.id] || {}
    const children = Array.isArray(mod.children) ? mod.children : []
    if (children.length === 0) {
      if (modCfg.smoke === false) continue
      targets.push({
        moduleId: mod.id,
        tabId: null,
        url: mod.path,
        readySelector: modCfg.readySelector || featureMap.defaultReadySelector,
        smokeRole: modCfg.smokeRole || 'admin',
      })
      continue
    }
    for (const child of children) {
      const subCfg = modCfg.submodules?.[child.id] || {}
      if (subCfg.smoke === false) continue
      targets.push({
        moduleId: mod.id,
        tabId: child.id,
        url: `${mod.path}?tab=${encodeURIComponent(child.id)}`,
        readySelector: subCfg.readySelector || modCfg.readySelector || featureMap.defaultReadySelector,
        smokeRole: subCfg.smokeRole || modCfg.smokeRole || 'admin',
      })
    }
  }

  return {
    targets,
    featureMap,
    errorBoundarySelector: featureMap.errorBoundarySelector,
    loginSelectors: featureMap.loginSelectors,
  }
}

export async function installWriteFuse(page, { allowWrites = false } = {}) {
  const blockedWrites = []
  if (!allowWrites) {
    await page.route('**/*', async (route) => {
      const req = route.request()
      if (isMutatingApiRequest(req.method(), req.url())) {
        blockedWrites.push({ method: req.method(), url: req.url() })
        return route.fulfill({
          status: 403,
          headers: { 'content-type': 'application/json', 'x-sgai-write-fuse': 'blocked' },
          body: JSON.stringify({ error: 'SGAI_WRITE_FUSE_BLOCKED', method: req.method(), url: req.url() }),
        })
      }
      return route.continue()
    })
  }
  return {
    blockedWrites,
    reset: () => { blockedWrites.length = 0 },
  }
}

export function attachPageMonitors(page) {
  const pageErrors = []
  const consoleErrors = []
  const httpErrors = []
  const fusedUrls = new Set()

  page.on('pageerror', (err) => pageErrors.push(err?.message || String(err)))
  page.on('response', (res) => {
    if (res.headers()?.['x-sgai-write-fuse'] === 'blocked') {
      fusedUrls.add(res.url())
      return
    }
    if (res.status() >= 400) {
      httpErrors.push({ status: res.status(), url: res.url() })
    }
  })
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const locUrl = msg.location()?.url
    if (locUrl && fusedUrls.has(locUrl) && msg.text().includes('403')) return
    consoleErrors.push(msg.text())
  })

  return {
    pageErrors,
    consoleErrors,
    httpErrors,
    reset: () => {
      pageErrors.length = 0
      consoleErrors.length = 0
      httpErrors.length = 0
      fusedUrls.clear()
    },
    getSummary: () => ({
      pageErrors: [...pageErrors],
      consoleErrors: [...consoleErrors],
      httpErrors: [...httpErrors],
    }),
  }
}

export async function loginWithEmailPassword(page, { email, password, loginSelectors }) {
  if (!email || !password) {
    throw new Error(
      'Faltan credenciales QA: copiá app/.env.e2e.example a app/.env.e2e.local y completá E2E_EMAIL y E2E_PASSWORD.'
    )
  }
  await page.goto('/login')
  await page.locator(loginSelectors.page).waitFor({ state: 'visible', timeout: 15_000 })
  await page.locator(loginSelectors.email).fill(email)
  await page.locator(loginSelectors.password).fill(password)
  await page.locator(loginSelectors.submit).click()
  await page.locator(loginSelectors.shell).waitFor({ state: 'visible', timeout: 20_000 })
}
