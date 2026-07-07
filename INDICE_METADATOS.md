# Índice de Metadatos — App_AlonCar

> **schema-version:** 1.0
> **Última actualización:** 2026-06-10
> **Propósito:** Tabla máquina para consumo exclusivo del Agente IA. Para navegación humana, usar `INDICE_CENTRAL.md`.

## Vocabularios Controlados

### Tipo
`portada` · `indice` · `pendientes` · `roadmap` · `instrucciones-agente` · `protocolo` · `documentacion-tecnica` · `documentacion-negocio` · `guia` · `registro` · `skill` · `codigo`

### Comportamiento-IA
`auditar-tareas` · `auditar-avances` · `auditar-reglas` · `auditar-decisiones` · `auditar-dependencias` · `consultar-siempre` · `validar-integridad` · `ignorar-en-auditoria` · `ninguno`

Múltiples valores se separan con `|`. El orden de izquierda a derecha define la precedencia de ejecución.

### Lectura
`completo` · `cambios` · `ignorar` · `primera-vez`

### Fase
`transversal` · `fase-1` · `fase-2` · `fase-2+` · `obsoleto`

### Estado
`activo` · `borrador` · `deprecado` · `archivado`

### Depende de
Rutas relativas al root, separadas por `|`. Usar `ninguno` si no tiene dependencias. Usar `pendiente-deteccion` si aún no fue analizado.

---

## Tabla de Metadatos

| Archivo | Tipo | Comportamiento-IA | Lectura | Fase | Estado | Última revisión | Depende de |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| README.md | portada | ninguno | primera-vez | transversal | activo | 2026-06-10 | ninguno |
| INDICE_CENTRAL.md | indice | consultar-siempre | completo | transversal | activo | 2026-06-14 | ninguno |
| INDICE_METADATOS.md | indice | consultar-siempre | completo | transversal | activo | 2026-06-14 | INDICE_CENTRAL.md |
| TAREAS_PENDIENTES.md | pendientes | auditar-tareas | cambios | transversal | activo | 2026-06-14 | INDICE_CENTRAL.md |
| INDICE_PLANILLAS.md | indice | consultar-siempre | completo | fase-2 | activo | 2026-06-18 | INDICE_CENTRAL.md \| TAREAS_PENDIENTES.md |
| ROADMAP_NEGOCIO.md | roadmap | auditar-avances | completo | transversal | activo | 2026-06-10 | INDICE_CENTRAL.md |
| GUIA_ANTIGRAVITY.md | instrucciones-agente | auditar-reglas | completo | transversal | activo | 2026-06-10 | INDICE_CENTRAL.md \| TAREAS_PENDIENTES.md \| ROADMAP_NEGOCIO.md |
| docs/01_infraestructura/README.md | indice | ninguno | ignorar | fase-1 | activo | 2026-06-10 | INDICE_CENTRAL.md |
| docs/01_infraestructura/01_stack_tecnico.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-06-10 | ninguno |
| docs/01_infraestructura/02_configuracion_env.md | guia | ninguno | completo | fase-1 | activo | 2026-06-10 | docs/01_infraestructura/01_stack_tecnico.md |
| docs/01_infraestructura/03_seguridad_credenciales.md | protocolo | ninguno | completo | fase-1 | activo | 2026-06-10 | ninguno |
| docs/01_infraestructura/04_arquitectura_mcp.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-06-10 | docs/01_infraestructura/01_stack_tecnico.md |
| docs/01_infraestructura/04_servidor_mcp.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-06-10 | docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/README.md | indice | ninguno | ignorar | transversal | activo | 2026-06-14 | INDICE_CENTRAL.md |
| docs/02_producto/registro_paso_a_paso.md | registro | auditar-decisiones | cambios | transversal | activo | 2026-06-10 | ninguno |
| docs/02_producto/01_decisiones/DEC-003-separacion-indices.md | decision | ninguno | cambios | transversal | activo | 2026-06-11 | docs/02_producto/README.md |
| docs/02_producto/02_errores/ERR-003-service-account-permisos-sheets.md | error | ninguno | cambios | transversal | activo | 2026-06-14 | docs/02_producto/README.md |
| docs/02_producto/03_conceptos/CON-003-arquitectura-bitacora.md | concepto | ninguno | cambios | transversal | activo | 2026-06-11 | docs/02_producto/README.md |
| docs/03_negocio/README.md | indice | ninguno | ignorar | fase-2 | activo | 2026-06-10 | INDICE_CENTRAL.md |
| docs/planillas/horas-planillas-de-registro.md | documentacion-negocio | ninguno | completo | fase-2 | borrador | 2026-06-18 | .agents/skills/legacy-mapping/SKILL.md |
| docs/planillas/materiales-planillas-registro.md | documentacion-negocio | ninguno | completo | fase-2 | borrador | 2026-07-06 | .agents/skills/legacy-mapping/SKILL.md |
| .agents/skills/README.md | guia | ninguno | primera-vez | transversal | activo | 2026-06-10 | ninguno |
| .agents/skills/legacy-mapping/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-06-18 | GUIA_ANTIGRAVITY.md |
| .agents/skills/legacy-mapping/recursos/template_mapeo.md | guia | ninguno | primera-vez | transversal | activo | 2026-06-18 | .agents/skills/legacy-mapping/SKILL.md |
| .agents/skills/session-audit/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-06-10 | GUIA_ANTIGRAVITY.md \| INDICE_CENTRAL.md \| INDICE_METADATOS.md |
| .agents/skills/product-collector/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-06-10 | GUIA_ANTIGRAVITY.md \| INDICE_CENTRAL.md \| INDICE_METADATOS.md |
| mcp-server/index.js | codigo | ninguno | ignorar | fase-1 | activo | 2026-06-14 | docs/01_infraestructura/04_arquitectura_mcp.md |
| mcp-server/package.json | codigo | ninguno | ignorar | fase-1 | activo | 2026-06-10 | mcp-server/index.js |
