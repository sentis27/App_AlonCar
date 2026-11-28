/**
 * featureMapCheck.mjs
 * Validador genérico sgai-core de paridad 1:1 entre navigationCatalog, featureMap.config.json
 * y anclajes data-testid obligatorios en componentes canónicos.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function validateFeatureMapParity({ navigationModules = [], featureMap, fileExists }) {
  const errors = []
  const mapMods = featureMap?.modules || {}
  const navIds = new Set(navigationModules.map((m) => m.id))
  let submoduleCount = 0

  for (const mod of navigationModules) {
    const entry = mapMods[mod.id]
    const children = Array.isArray(mod.children) ? mod.children : []
    submoduleCount += children.length

    if (!entry) {
      errors.push(`[FeatureMap] Falta módulo "${mod.id}" en featureMap.config.json`)
      continue
    }
    if (!entry.ownerPage || !fileExists(entry.ownerPage)) {
      errors.push(`[FeatureMap] ownerPage inválido o inexistente para "${mod.id}": ${entry.ownerPage || '(vacío)'}`)
    }
    if (!entry.readySelector || typeof entry.readySelector !== 'string') {
      errors.push(`[FeatureMap] Falta readySelector para "${mod.id}"`)
    }

    const expectedTabs = new Set(children.map((c) => c.id))
    const mappedTabs = new Set(Object.keys(entry.submodules || {}))
    for (const tabId of expectedTabs) {
      if (!mappedTabs.has(tabId)) {
        errors.push(`[FeatureMap] Falta submódulo "${mod.id}.${tabId}" en featureMap.config.json`)
      }
    }
    for (const tabId of mappedTabs) {
      if (!expectedTabs.has(tabId)) {
        errors.push(`[FeatureMap] Submódulo huérfano "${mod.id}.${tabId}" ausente en navigationCatalog`)
      }
    }
  }

  for (const modId of Object.keys(mapMods)) {
    if (!navIds.has(modId)) {
      errors.push(`[FeatureMap] Módulo huérfano "${modId}" ausente en navigationCatalog`)
    }
  }

  return { errors, moduleCount: navigationModules.length, submoduleCount }
}

export function validateRequiredTestIds(rootDir, requiredTestIds = []) {
  const errors = []
  let testIdCount = 0

  for (const spec of requiredTestIds) {
    const full = path.join(rootDir, spec.file)
    if (!fs.existsSync(full)) {
      errors.push(`[FeatureMap] Archivo requerido para data-testid no existe: ${spec.file}`)
      continue
    }
    const content = fs.readFileSync(full, 'utf8')
    for (const id of spec.ids || []) {
      testIdCount++
      const re = new RegExp(`data-testid\\s*=\\s*(?:["']${escapeRe(id)}["']|\\{\`${escapeRe(id)})`)
      if (!re.test(content)) {
        errors.push(`[FeatureMap] Falta data-testid="${id}" en ${spec.file}`)
      }
    }
  }

  return { errors, testIdCount }
}

export async function checkFeatureMapIntegrity(rootDir, config) {
  const fmCfg = config?.featureMap || {}
  if (!fmCfg.configPath) {
    return { errors: [], moduleCount: 0, submoduleCount: 0, testIdCount: 0 }
  }

  const mapFull = path.join(rootDir, fmCfg.configPath)
  if (!fs.existsSync(mapFull)) {
    return {
      errors: [`[FeatureMap] Falta archivo configurado: ${fmCfg.configPath}`],
      moduleCount: 0,
      submoduleCount: 0,
      testIdCount: 0,
    }
  }

  const navRel = config?.where?.navigationCatalogPath || 'app/src/lib/navigationCatalog.js'
  const navFull = path.join(rootDir, navRel)
  if (!fs.existsSync(navFull)) {
    return {
      errors: [`[FeatureMap] Falta catálogo de navegación: ${navRel}`],
      moduleCount: 0,
      submoduleCount: 0,
      testIdCount: 0,
    }
  }

  const navMod = await import(pathToFileURL(navFull).href)
  const featureMap = JSON.parse(fs.readFileSync(mapFull, 'utf8'))
  const parity = validateFeatureMapParity({
    navigationModules: navMod.NAVIGATION_MODULES || [],
    featureMap,
    fileExists: (rel) => fs.existsSync(path.join(rootDir, rel)),
  })
  const testIds = validateRequiredTestIds(rootDir, fmCfg.requiredTestIds || [])

  return {
    errors: [...parity.errors, ...testIds.errors],
    moduleCount: parity.moduleCount,
    submoduleCount: parity.submoduleCount,
    testIdCount: testIds.testIdCount,
  }
}
