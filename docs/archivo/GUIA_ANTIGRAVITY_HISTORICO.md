# Archivo Histórico — Convenciones Adicionales de `GUIA_ANTIGRAVITY.md`

> **Origen:** Extraído de `GUIA_ANTIGRAVITY.md` (versión `2026-07-17`) durante el saneamiento E4 (`2026-11-13`).  
> **Nota:** Las reglas operativas vigentes, Router `SKL-016`, Regla de Oro de Disco y Pipeline F1–F4 viven en [GEMINI.md](../../GEMINI.md). Este archivo conserva únicamente las convenciones históricas que no están repetidas en `GEMINI.md` ni en `.agents/skills/README.md`.

---

## 1. Clasificación de Confianza en Afirmaciones

Cuando se emita una afirmación técnica no trivial en auditorías o análisis exploratorios:
- **`[Seguro]`:** Confirmado en código o documentación leída en la sesión (ej. *"[Seguro] El `.env` debe estar en `.gitignore`"*).
- **`[Probable]`:** Inferencia sólida con alta evidencia pero pendiente de prueba runtime.
- **`[Adivinando]`:** Especulación; debe declararse explícitamente y validarse antes de implementar.

## 2. Flujo Histórico para Crear Skills de Lógica de Negocio

```text
SPEC (docs/03_negocio/ o docs/modulos/) ➔ VALIDACIÓN (aprobación del usuario) ➔ SKILL (.agents/skills/MX-modulo/nombre-skill/SKILL.md)
```
- **Regla:** Nunca crear una Skill específica de lógica de negocio sin especificación validada previa.
- **Criterio de creación:** Instrucciones repetidas en múltiples tareas del módulo, estándares que vigilar automáticamente, decisiones arbóreas o lógica exclusiva del módulo.

## 3. Ejemplos Históricos de Tono y Comunicación

- **Específico > Genérico:** Apuntar a archivos y líneas concretas (`docs/01_infraestructura/02_configuracion_env.md`) en lugar de respuestas vagas.
- **Educativo y sin suposiciones:** Preguntar cuando la prioridad o el enfoque arquitectónico es ambiguo; ejecutar directo cuando la instrucción es explícita y determinística.
