# 🔗 Integraciones n8n

Este documento describe dónde y cómo se versionan los workflows de n8n del proyecto, y cómo navegarlos.

## 1. Ubicación de los Workflows

    workflows/
    ├── _meta/
    │   ├── INDEX.md        ← Tabla maestra: estado, migración y SDD de cada workflow
    │   ├── PLANTILLA.md     ← Cómo crear un nuevo workflow (incluye regla de SDD obligatorio)
    │   └── migracion.md     ← Estado global de migración Sheets→Supabase, por campo
    └── <dominio>/
        └── <nombre-workflow>/
            ├── workflow.json  ← Export crudo desde n8n
            ├── README.md      ← Descripción, fuentes de datos, credenciales, notas
            └── SDD.md         ← Reglas de negocio, lógica, casos edge, mapeo de campos a Supabase

## 2. Cómo Navegar

- ¿Querés saber qué workflows existen y su estado? → `workflows/_meta/INDEX.md`
- ¿Querés crear uno nuevo? → `workflows/_meta/PLANTILLA.md`
- ¿Querés ver el avance global de migración a Supabase? → `workflows/_meta/migracion.md`
- ¿Querés entender la lógica de negocio de un workflow puntual? → `workflows/<dominio>/<nombre>/SDD.md`

## 3. Regla de Activación

Estados posibles en `INDEX.md`: `activo` (producción, SDD completo) / `activo-sin-SDD` (producción, SDD pendiente — deuda técnica) / `desarrollo` (no productivo). Ningún workflow pasa a `activo` sin sufijo mientras su `SDD.md` esté `pendiente`. Ver `workflows/_meta/PLANTILLA.md`.

## 4. Seguridad

Los `workflow.json` no deben contener tokens ni credenciales en texto plano. Ver `docs/01_infraestructura/03_seguridad_credenciales.md`.

## 5. Estado Actual

Ver `workflows/_meta/INDEX.md` para el listado vivo.
