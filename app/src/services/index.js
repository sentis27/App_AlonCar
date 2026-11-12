/**
 * services/index.js
 * Fachada Central de Servicios y Clean Architecture para AlonCar ERP.
 * 
 * Formaliza la arquitectura de 4 capas:
 * Route / Page (Presentación) -> Component (Subpaneles Modulares) -> Service (Capa de Negocio) -> Supabase (Persistencia)
 * 
 * Elimina la fuga de capas (Domain Leaks) y centraliza todas las mutaciones con auditoría obligatoria.
 */

// Servicios de Dominio
export * from './personalService.js'
export * from './comprasService.js'
export * from './laborService.js'
export * from './shipsService.js'

// Servicios Unificados desde lib/ (Retrocompatibilidad e Indexación Central)
export * from '../lib/panolService.js'
export * from '../lib/workOrdersService.js'
export * from '../lib/tercerosService.js'
export * from '../lib/auditService.js'
export * from '../lib/macroVariablesService.js'
