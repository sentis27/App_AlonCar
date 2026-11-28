import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseEnvText,
  loadE2eEnv,
  isMutatingApiRequest,
  loadSmokeTargets,
} from '../e2e/core/e2eRuntime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

describe('sgai-core Etapa 4: e2eRuntime, Fusible A y portabilidad Playwright', () => {
  it('parseEnvText parsea claves, quita comillas e ignora comentarios y vacíos', () => {
    const parsed = parseEnvText([
      '# comentario',
      '',
      'E2E_BASE_URL="http://127.0.0.1:5173"',
      "E2E_EMAIL='qa@empresa.com'",
      'E2E_PASSWORD=clave_segura=123',
      'E2E_ALLOW_WRITES=false',
    ].join('\n'))

    expect(parsed).toEqual({
      E2E_BASE_URL: 'http://127.0.0.1:5173',
      E2E_EMAIL: 'qa@empresa.com',
      E2E_PASSWORD: 'clave_segura=123',
      E2E_ALLOW_WRITES: 'false',
    })
  })

  it('loadE2eEnv respeta default seguro Fusible A (allowWrites=false)', () => {
    const tmpDir = fs.mkdtempSync(path.join(APP_DIR, 'tests/.tmp-e2e-'))
    try {
      fs.writeFileSync(path.join(tmpDir, '.env.e2e.local'), 'E2E_EMAIL=test@demo.com\nE2E_PASSWORD=secret\n', 'utf8')
      const env = loadE2eEnv(tmpDir)
      expect(env.allowWrites).toBe(false)
      expect(env.hasCredentials).toBe(true)
      expect(env.email).toBe('test@demo.com')
      expect(env.baseUrl).toBe('http://127.0.0.1:5173')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('isMutatingApiRequest bloquea escrituras a datos/RPC y permite lecturas GET y login /auth/v1/', () => {
    const blocked = [
      ['POST', 'https://xyz.supabase.co/rest/v1/workers'],
      ['PATCH', 'https://xyz.supabase.co/rest/v1/work_orders?id=eq.1'],
      ['PUT', 'https://xyz.supabase.co/storage/v1/object/docs/a.pdf'],
      ['DELETE', 'https://xyz.supabase.co/rest/v1/labor_logs?id=eq.9'],
      ['POST', 'https://xyz.supabase.co/functions/v1/notify'],
      ['POST', 'http://127.0.0.1:5173/rpc/smoke_probe'],
    ]
    for (const [method, url] of blocked) {
      expect(isMutatingApiRequest(method, url), `${method} ${url} debe bloquearse`).toBe(true)
    }

    const allowed = [
      ['GET', 'https://xyz.supabase.co/rest/v1/workers?select=*'],
      ['HEAD', 'https://xyz.supabase.co/rest/v1/ships'],
      ['POST', 'https://xyz.supabase.co/auth/v1/token?grant_type=password'],
      ['POST', 'http://127.0.0.1:5173/api/local-ping'],
    ]
    for (const [method, url] of allowed) {
      expect(isMutatingApiRequest(method, url), `${method} ${url} debe permitirse`).toBe(false)
    }
  })

  it('loadSmokeTargets genera los 42 destinos (dashboard + 41 submódulos) con selectores válidos', async () => {
    const catalog = await loadSmokeTargets(ROOT_DIR)
    expect(catalog.targets).toHaveLength(42)
    expect(catalog.loginSelectors?.email).toBeTruthy()
    expect(catalog.errorBoundarySelector).toBeTruthy()
    for (const target of catalog.targets) {
      expect(target.url.startsWith('/')).toBe(true)
      expect(target.readySelector).toBeTruthy()
    }
  })

  it('garantiza portabilidad 100% del motor Playwright Core (cero tokens de AlonCar)', () => {
    const coreFiles = [
      'app/playwright.config.js',
      'app/tests/e2e/core/e2eRuntime.mjs',
      'app/tests/e2e/core/smokeCatalog.spec.js',
      'app/tests/e2e/core/smokeEngineSelfTest.spec.js',
    ]
    const forbiddenProjectTokens = [
      'AlonCar',
      'PanolMovimientosPanel',
      'WorkOrders',
      'Vanoli',
      'senti',
      'Presentacion',
      'work_items',
      'TAREAS_PENDIENTES',
      'BITACORA_DELTAS_SESION',
      'PLAN_OPTIMIZACION_IA',
    ]

    for (const rel of coreFiles) {
      const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8')
      for (const token of forbiddenProjectTokens) {
        expect(content, `${rel} no debe contener "${token}"`).not.toContain(token)
      }
    }
  })
})
