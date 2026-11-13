---
id: DEC-022
tipo: decision
fecha: 2026-11-13
modulo: GS-004 · Resumen Gerencial (/resumen-gerencial)
estado: aprobado_e_implementado
autor: Gerencia General (Nivel Alfa)
---

# DEC-022: Módulo Resumen Gerencial (GS-004), Comparador Canvas y Remito Comercial Nivel Alfa

## 1. Contexto de Negocio
Se implementó el reemplazo integral de `GS-004` (`RESUMEN`, `RESUMEN 2` y hojas de respaldo `MATERIALES`, `HORAS`, `TERCEROS`), unificando el análisis económico de costos directos por buque, la comparación multidimensional entre obras y la emisión del Remito Comercial Nivel Alfa con menor fricción visual respecto al flujo histórico de Excel.

## 2. Decisiones Aprobadas
1. **Arquitectura híbrida (`METRICAS_ANALISIS` + `CARGA_EDICION`):**
   - Submódulo 1 (`Resumen de Obra & Costos`, `RESUMEN 2` y hojas `MATERIALES`/`HORAS`/`TERCEROS`): arquetipo **Gallina (`METRICAS_ANALISIS`)**, estrictamente de solo lectura y cálculo automático vía `workCostRules.js`.
   - Submódulo 2 (`Comparador de Obras Canvas`): arquetipo **Gallina (`METRICAS_ANALISIS`)** en dos niveles (Nivel 1 por buque con métricas absolutas, porcentajes y ratios `/día` o `/m²`; Nivel 2 cruce OT contra OT).
   - Submódulo 3 (`Remito Comercial & Tarifario Nivel Alfa`): arquetipo **Gallo (`CARGA_EDICION`)** exclusivo para Nivel Alfa, persistido en `system_settings` (`remito_comercial_por_buque` y `drydock_rate_card_alfa`) con trazabilidad en `audit_logs`.
2. **Regla estricta para `ELEM. SEGURIDAD (REF. ASTILLERO)`:** se calcula y exhibe separado en el bloque global del buque y en la matriz por OT con etiqueta informativa, pero **nunca** se suma al `TOTAL COSTO DIRECTO US$`.
3. **Navegación rápida `3x2`:** accesos directos separados entre vista general (`MATERIALES GENERAL`, `HORAS GENERALES`, `TERCEROS GENERAL`) y vista acotada por OT (`MATERIALES POR O.T`, `HORAS POR O.T`, `TERCEROS POR O.T`), con retorno directo al Resumen sin alterar permisos ni duplicar datos de las planillas fuente.
4. **Regla financiera de Horas:** exclusión de `work_type = 'PRESUPUESTO'` del costo directo en Horas (**DEC-013**) y separación visible entre Horas Aprobadas y Horas Pendientes de Aprobar (`'R'`).
