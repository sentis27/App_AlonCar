# Índice de Metadatos — App_AlonCar

> **schema-version:** 1.1
> **Última actualización:** 2026-11-13
> **Propósito:** Tabla máquina para consumo exclusivo del Agente IA. Para navegación humana, usar `INDICE_CENTRAL.md`.

## Vocabularios Controlados

### Tipo
`portada` · `indice` · `pendientes` · `roadmap` · `instrucciones-agente` · `protocolo` · `documentacion-tecnica` · `documentacion-negocio` · `catalogo-negocio` · `guia` · `registro` · `decision` · `error` · `concepto` · `proceso` · `skill` · `codigo`

### Comportamiento-IA
`auditar-tareas` · `auditar-avances` · `auditar-reglas` · `auditar-decisiones` · `auditar-dependencias` · `consultar-siempre` · `validar-integridad` · `ignorar-en-auditoria` · `ninguno`

Múltiples valores se separan con `|`. El orden de izquierda a derecha define la precedencia de ejecución.

### Lectura
`completo` · `cambios` · `ignorar` · `primera-vez`

### Fase
`transversal` · `fase-1` · `fase-2` · `fase-2+` · `obsoleto`

### Estado
`activo` · `borrador` · `confirmado` · `deprecado` · `archivado`

### Depende de
Rutas relativas al root, separadas por `|`. Usar `ninguno` si no tiene dependencias. Usar `pendiente-deteccion` si aún no fue analizado.

---

## Tabla de Metadatos

| Archivo | Tipo | Comportamiento-IA | Lectura | Fase | Estado | Última revisión | Depende de |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| README.md | portada | ninguno | primera-vez | transversal | activo | 2026-11-13 | INDICE_CENTRAL.md |
| GEMINI.md | instrucciones-agente | auditar-reglas \| consultar-siempre | completo | transversal | activo | 2026-11-13 | ninguno |
| CLAUDE.md | instrucciones-agente | consultar-siempre | ignorar | transversal | activo | 2026-11-13 | GEMINI.md |
| GUIA_ANTIGRAVITY.md | instrucciones-agente | ninguno | ignorar | transversal | deprecado | 2026-11-13 | GEMINI.md |
| INDICE_CENTRAL.md | indice | consultar-siempre | completo | transversal | activo | 2026-11-13 | ninguno |
| INDICE_METADATOS.md | indice | consultar-siempre | completo | transversal | activo | 2026-11-13 | INDICE_CENTRAL.md |
| TAREAS_PENDIENTES.md | pendientes | auditar-tareas | cambios | transversal | activo | 2026-11-13 | INDICE_CENTRAL.md |
| PLAN_OPTIMIZACION_IA.md | roadmap | auditar-avances | cambios | transversal | activo | 2026-11-13 | GEMINI.md |
| INDICE_PLANILLAS.md | indice | consultar-siempre | completo | fase-2 | activo | 2026-06-18 | INDICE_CENTRAL.md \| TAREAS_PENDIENTES.md |
| ROADMAP_NEGOCIO.md | roadmap | auditar-avances | completo | transversal | activo | 2026-06-10 | INDICE_CENTRAL.md |
| app/README.md | guia | ninguno | primera-vez | fase-2+ | activo | 2026-11-13 | README.md |
| docs/00_ARQUITECTURA_TABLAS_Y_FOLIOS.md | protocolo | auditar-reglas \| consultar-siempre | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/01_infraestructura/README.md | indice | ninguno | ignorar | fase-1 | activo | 2026-11-13 | INDICE_CENTRAL.md |
| docs/01_infraestructura/01_stack_tecnico.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-06-10 | ninguno |
| docs/01_infraestructura/02_configuracion_env.md | guia | ninguno | completo | fase-1 | activo | 2026-06-10 | docs/01_infraestructura/01_stack_tecnico.md |
| docs/01_infraestructura/03_seguridad_credenciales.md | protocolo | ninguno | completo | fase-1 | activo | 2026-06-10 | ninguno |
| docs/01_infraestructura/04_arquitectura_mcp.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-06-10 | docs/01_infraestructura/01_stack_tecnico.md |
| docs/01_infraestructura/04_servidor_mcp.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-11-13 | docs/01_infraestructura/01_stack_tecnico.md |
| docs/01_infraestructura/05_integraciones_n8n.md | documentacion-tecnica | ninguno | completo | fase-1 | activo | 2026-07-19 | workflows/_meta/INDEX.md |
| docs/02_producto/README.md | indice | ninguno | ignorar | transversal | activo | 2026-11-13 | INDICE_CENTRAL.md |
| docs/02_producto/registro_paso_a_paso.md | registro | auditar-decisiones | cambios | transversal | activo | 2026-06-10 | ninguno |
| docs/02_producto/ESTANDARES_MODULOS_UI_UX.md | documentacion-tecnica | ninguno | ignorar | transversal | deprecado | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md | protocolo | consultar-siempre | completo | transversal | activo | 2026-11-13 | INDICE_CENTRAL.md |
| docs/02_producto/estandares/01_CLASIFICACION_FUNCIONAL_GALLO_O_GALLINA.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/02_ARQUITECTURA_VISUAL_4_ZONAS_Y_COLORES.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/03_BUSCADOR_OMNICANAL_CRAWLER_PROFUNDO.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/04_ESTANDAR_CARGA_THEAD_RIBBON_Y_BOTONES.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/05_BARRA_INFERIOR_FLOTANTE_CALCULOS_Y_LIMPIEZA.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/06_COMPONENTES_CANONICOS_MODALES.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/estandares/07_ESTANDAR_TRAZABILIDAD_Y_AUDITORIA.md | protocolo | auditar-reglas | completo | transversal | activo | 2026-11-13 | docs/02_producto/estandares/00_INDICE_DE_MODULOS_Y_CLASIFICACION.md |
| docs/02_producto/01_decisiones/DEC-003-separacion-indices.md | decision | ninguno | cambios | transversal | activo | 2026-06-11 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-004-desdoblamiento-nodo-validaciones-e4.md | decision | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/01_decisiones/DEC-005-eliminacion-desdoblamiento-horas-ot-ambiguas.md | decision | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/01_decisiones/DEC-006-router-jerarquico-e3a-filtrado-catalogos.md | decision | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/01_decisiones/DEC-007-blindaje-prompting-vs-parches-postprocesamiento.md | decision | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/01_decisiones/DEC-008-enrutamiento-whatsapp-participantpn.md | decision | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/01_decisiones/DEC-009-porcentajes-descuento-consumibles.md | decision | ninguno | cambios | fase-2 | borrador | 2026-07-21 | docs/02_producto/README.md \| docs/planillas/materiales-planillas-registro.md |
| docs/02_producto/01_decisiones/DEC-010-terminal-panol-verificacion-visual.md | decision | ninguno | cambios | fase-2 | borrador | 2026-07-21 | docs/02_producto/README.md \| docs/planillas/materiales-planillas-registro.md |
| docs/02_producto/01_decisiones/DEC-011-cierre-ot-dashboard-historico.md | decision | ninguno | cambios | fase-2 | borrador | 2026-07-22 | docs/02_producto/README.md \| INDICE_PLANILLAS.md |
| docs/02_producto/01_decisiones/DEC-012-estandarizacion-dimension-quincenal.md | decision | ninguno | cambios | fase-2 | borrador | 2026-07-22 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-013-separacion-horas-tabuladas-presupuestos.md | decision | ninguno | cambios | fase-2 | borrador | 2026-07-23 | docs/02_producto/README.md \| docs/planillas/resumen-gerencial.md |
| docs/02_producto/01_decisiones/DEC-014-autocarga-prc-terceros-desde-workitem.md | decision | ninguno | cambios | fase-2 | confirmado | 2026-10-20 | docs/02_producto/README.md \| docs/planillas/terceros-planilla.md |
| docs/02_producto/01_decisiones/DEC-015-interfaz-grilla-edicion-inline-permisos.md | decision | ninguno | cambios | fase-2+ | confirmado | 2026-08-09 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-016-tooltip-descripcion-ot-dropdown.md | decision | ninguno | cambios | fase-2+ | confirmado | 2026-08-09 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-017-leyendas-ayuda-comprobantes.md | decision | ninguno | cambios | fase-2+ | confirmado | 2026-08-10 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-018-tabulador-inteligente-gobernanza-ia-rubro-emergencia.md | decision | ninguno | cambios | fase-2+ | activo | 2026-10-22 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-019-modulo-barcos-ficha-tecnica-y-calendario-estadias.md | decision | ninguno | cambios | fase-2+ | activo | 2026-10-22 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-020-terminales-de-trabajo-documentacion-naval-y-gestion-armadores.md | decision | ninguno | cambios | fase-2+ | activo | 2026-10-22 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-021-modulo-terceros-ciclo-comprobantes-y-catalogos.md | decision | ninguno | cambios | fase-2+ | activo | 2026-10-22 | docs/02_producto/README.md |
| docs/02_producto/01_decisiones/DEC-022-resumen-gerencial-gs004-comparador-y-remito-alfa.md | decision | ninguno | cambios | fase-2+ | activo | 2026-11-13 | docs/02_producto/README.md \| docs/planillas/resumen-gerencial.md |
| docs/02_producto/01_decisiones/DEC-023-panol-gases-doble-imputacion-y-trazabilidad-gaseras.md | decision | ninguno | cambios | fase-2+ | activo | 2026-11-13 | docs/02_producto/README.md \| docs/MATRIZ_RESPONSABILIDAD_DATOS.md |
| docs/02_producto/01_decisiones/DEC-024-imputacion-horas-materiales-dolar-quincenal.md | decision | ninguno | cambios | fase-2 | confirmado | 2026-11-13 | docs/02_producto/README.md \| docs/planillas/bd-newsystemm.md |
| docs/02_producto/01_decisiones/DEC-025-reconciliacion-horas-materiales-inbox.md | decision | ninguno | cambios | fase-2 | confirmado | 2026-11-13 | docs/02_producto/README.md \| docs/planillas/reconciliacion-horas-materiales.md |
| docs/02_producto/01_decisiones/DEC-026-resumen-gerencial-horas-presupuestos-workspace.md | decision | ninguno | cambios | fase-2 | confirmado | 2026-11-13 | docs/02_producto/README.md \| docs/planillas/resumen-gerencial.md |
| docs/02_producto/02_errores/ERR-003-service-account-permisos-sheets.md | error | ninguno | cambios | transversal | activo | 2026-06-14 | docs/02_producto/README.md |
| docs/02_producto/02_errores/ERR-004-hooks-condicionales-pantalla-negra-picker-modal.md | error | ninguno | cambios | fase-2+ | borrador | 2026-11-12 | docs/02_producto/README.md |
| docs/02_producto/02_errores/ERR-005-ancho-restringido-max-w-7xl-oculta-acciones-nomina.md | error | ninguno | cambios | fase-2+ | borrador | 2026-11-13 | docs/02_producto/README.md |
| docs/02_producto/03_conceptos/CON-003-arquitectura-bitacora.md | concepto | ninguno | cambios | transversal | activo | 2026-06-11 | docs/02_producto/README.md |
| docs/02_producto/03_conceptos/CON-004-modelo-paginacion-por-operario.md | concepto | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/planillas/horas-planillas-de-registro.md |
| docs/02_producto/04_procesos/PRO-002-mapeo-blindado-estadisticas-log.md | proceso | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/04_procesos/PRO-003-alertas-humanizadas-e9a.md | proceso | ninguno | cambios | transversal | activo | 2026-07-19 | docs/02_producto/README.md \| docs/01_infraestructura/01_stack_tecnico.md |
| docs/02_producto/05_auditorias/README.md | indice | consultar-siempre | completo | transversal | activo | 2026-11-10 | INDICE_CENTRAL.md |
| docs/02_producto/05_auditorias/LINEA_BASE_ARQUITECTURA.md | registro | auditar-tareas | completo | transversal | activo | 2026-11-10 | docs/02_producto/05_auditorias/README.md |
| docs/02_producto/05_auditorias/BITACORA_DELTAS_SESION.md | registro | auditar-tareas | cambios | transversal | activo | 2026-11-13 | docs/02_producto/05_auditorias/README.md |
| docs/02_producto/05_auditorias/archivo/BITACORA_2026-11.md | registro | ignorar-en-auditoria | ignorar | transversal | archivado | 2026-11-13 | docs/02_producto/05_auditorias/BITACORA_DELTAS_SESION.md |
| docs/archivo/TAREAS_COMPLETADAS_2026-11.md | registro | ignorar-en-auditoria | ignorar | transversal | archivado | 2026-11-13 | TAREAS_PENDIENTES.md |
| docs/archivo/GUIA_ANTIGRAVITY_HISTORICO.md | registro | ignorar-en-auditoria | ignorar | transversal | archivado | 2026-11-13 | GUIA_ANTIGRAVITY.md |
| docs/archivo/ESTANDARES_MODULOS_UI_UX_DETALLE_HISTORICO.md | documentacion-tecnica | ignorar-en-auditoria | ignorar | transversal | archivado | 2026-11-13 | docs/02_producto/ESTANDARES_MODULOS_UI_UX.md |
| docs/03_negocio/README.md | indice | ninguno | ignorar | fase-2 | activo | 2026-11-13 | INDICE_CENTRAL.md |
| docs/03_negocio/00_reglas_negocio.md | documentacion-negocio | auditar-reglas | completo | fase-2 | activo | 2026-07-19 | docs/03_negocio/README.md |
| docs/03_negocio/proyecto_perfil_puesto_y_matriz_responsabilidades.md | documentacion-negocio | auditar-reglas | completo | fase-2 | activo | 2026-10-09 | INDICE_CENTRAL.md |
| docs/03_negocio/revision_planillas.md | documentacion-negocio | auditar-reglas | completo | fase-2 | activo | 2026-08-21 | docs/03_negocio/README.md |
| docs/03_negocio/tarifario_puesta_en_seco_alfa.md | catalogo-negocio | ninguno | completo | fase-2 | confirmado | 2026-08-21 | docs/planillas/resumen-gerencial.md |
| docs/MATRIZ_RESPONSABILIDAD_DATOS.md | documentacion-negocio | auditar-reglas | cambios | fase-2+ | activo | 2026-11-13 | INDICE_CENTRAL.md |
| docs/spec_tabla_de_tablas_v7.md | documentacion-tecnica | auditar-reglas | completo | fase-2 | activo | 2026-08-21 | docs/03_negocio/README.md |
| docs/plan_desarrollo_aloncar.md | roadmap | ninguno | ignorar | fase-2 | activo | 2026-07-24 | ROADMAP_NEGOCIO.md |
| docs/manual_de_usuario_aloncar.md | guia | ninguno | cambios | fase-2+ | activo | 2026-11-13 | INDICE_CENTRAL.md |
| docs/modulos/M1_barcos/ficha_tecnica.md | documentacion-negocio | ninguno | completo | fase-2+ | activo | 2026-10-22 | docs/02_producto/01_decisiones/DEC-019-modulo-barcos-ficha-tecnica-y-calendario-estadias.md |
| docs/modulos/M4b_compras.md | documentacion-negocio | ninguno | completo | fase-2+ | activo | 2026-08-21 | docs/planillas/compras-planilla-registro.md |
| docs/modulos/M4c_gestor_documental_compras.md | documentacion-negocio | ninguno | completo | fase-2+ | activo | 2026-08-21 | docs/modulos/M4b_compras.md |
| docs/modulos/M7_IA/procedimientos/ejemplo_gold_standard_recepcion.md | guia | ninguno | cambios | fase-2+ | activo | 2026-10-22 | docs/02_producto/01_decisiones/DEC-018-tabulador-inteligente-gobernanza-ia-rubro-emergencia.md |
| docs/modulos/M7_IA/procedimientos/prompt_estilo_redaccion.md | guia | ninguno | cambios | fase-2+ | activo | 2026-10-22 | docs/02_producto/01_decisiones/DEC-018-tabulador-inteligente-gobernanza-ia-rubro-emergencia.md |
| docs/planillas/horas-planillas-de-registro.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-07-23 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/materiales-planillas-registro.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-07-23 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/lista-trabajos-en-progreso.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-07-23 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/resumen-gerencial.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-11-13 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/terceros-planilla.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-07-23 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/bd-newsystemm.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-11-13 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/reconciliacion-horas-materiales.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-11-13 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/compras-planilla-registro.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-08-21 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| docs/planillas/stock-planilla-registro.md | documentacion-negocio | ninguno | completo | fase-2 | confirmado | 2026-08-21 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| workflows/_meta/INDEX.md | indice | consultar-siempre \| auditar-dependencias | completo | transversal | activo | 2026-07-19 | GEMINI.md |
| workflows/_meta/PLANTILLA.md | protocolo | auditar-reglas | primera-vez | transversal | activo | 2026-07-19 | workflows/_meta/INDEX.md |
| workflows/_meta/migracion.md | guia | ninguno | primera-vez | fase-1 | activo | 2026-07-19 | workflows/_meta/INDEX.md |
| workflows/operaciones/reporte-horas/README.md | guia | ninguno | primera-vez | fase-2 | activo | 2026-07-19 | workflows/_meta/INDEX.md |
| workflows/operaciones/reporte-horas/SDD.md | documentacion-tecnica | auditar-reglas | cambios | fase-2 | activo | 2026-07-19 | workflows/_meta/PLANTILLA.md |
| workflows/operaciones/reporte-ordenes-trabajo/README.md | guia | ninguno | primera-vez | fase-2 | activo | 2026-07-19 | workflows/_meta/INDEX.md |
| workflows/operaciones/reporte-ordenes-trabajo/SDD.md | documentacion-tecnica | auditar-reglas | cambios | fase-2 | activo | 2026-07-19 | workflows/_meta/PLANTILLA.md |
| workflows/legacy/Reporte_Retiros_diarioMateriales.json | codigo | ninguno | ignorar | transversal | archivado | 2026-07-23 | ninguno |
| .agents/skills/README.md | guia | ninguno | primera-vez | transversal | activo | 2026-11-13 | SKILLS_REGISTRY.md |
| .agents/skills/SKILLS_REGISTRY.md | indice | consultar-siempre | completo | transversal | activo | 2026-11-13 | INDICE_CENTRAL.md |
| .agents/skills/M1-activos/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/M2-recursos/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/M3-operaciones/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/M4-logistica/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/M5-comercial/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/M6-cierre/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/DIVISION.md | indice | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/automation-governance/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/caveman/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/legacy-mapping/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/legacy-mapping/recursos/template_mapeo.md | guia | ninguno | primera-vez | transversal | activo | 2026-06-18 | .agents/skills/transversal/legacy-mapping/SKILL.md |
| .agents/skills/transversal/product-collector/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/rtk/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/session-audit/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-07-23 | INDICE_CENTRAL.md |
| .agents/skills/transversal/control-calidad-entrega/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/planificacion-por-etapas/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/ingenieria-codigo-senior/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/chasis-docker-multiapp/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/motor-backend-capas/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/ergonomia-flujo-visual-senior/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/data-grid-poweruser/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/schema-gatekeeper/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/defensive-erp-contracts/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/context-aware-skill-router/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| .agents/skills/transversal/architectural-modularity-auditor/SKILL.md | skill | ninguno | primera-vez | transversal | activo | 2026-11-13 | .agents/skills/SKILLS_REGISTRY.md |
| mcp-server/index.js | codigo | ninguno | ignorar | fase-1 | activo | 2026-06-14 | docs/01_infraestructura/04_arquitectura_mcp.md |
| mcp-server/package.json | codigo | ninguno | ignorar | fase-1 | activo | 2026-06-10 | mcp-server/index.js |
| app/src/pages/ResumenGerencial.jsx | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | docs/02_producto/01_decisiones/DEC-022-resumen-gerencial-gs004-comparador-y-remito-alfa.md |
| app/src/hooks/useResumenGerencialState.js | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/lib/managerialSummaryService.js |
| app/src/lib/managerialSummaryService.js | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/lib/drydockCatalogConstants.js \| app/src/lib/workCostRules.js |
| app/src/lib/drydockCatalogConstants.js | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | docs/03_negocio/tarifario_puesta_en_seco_alfa.md |
| app/src/components/panol/MaterialAutocompleteInput.jsx | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/lib/allocationEngine.js \| app/src/lib/panolConstants.js |
| app/src/components/panol/GasDeliveryInlinePanel.jsx | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/lib/panolConstants.js |
| app/src/components/panol/GasFinalReturnModal.jsx | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/lib/panolService.js |
| app/src/components/panol/GasSupplierMovementModal.jsx | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/lib/panolConstants.js \| app/src/lib/panolService.js |
| app/src/components/panol/GasTraceabilityGrid.jsx | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | app/src/hooks/useSpreadsheetGrid.js \| app/src/lib/panolService.js \| app/src/lib/panolConstants.js |
| supabase/migrations/0038_panol_compliance_requirements.sql | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | docs/MATRIZ_RESPONSABILIDAD_DATOS.md |
| supabase/migrations/0039_gas_tx_link_and_indexes.sql | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | docs/02_producto/01_decisiones/DEC-023-panol-gases-doble-imputacion-y-trazabilidad-gaseras.md |
| supabase/migrations/0040_gas_supplier_traceability.sql | codigo | ninguno | ignorar | fase-2+ | activo | 2026-11-13 | docs/02_producto/01_decisiones/DEC-023-panol-gases-doble-imputacion-y-trazabilidad-gaseras.md |
