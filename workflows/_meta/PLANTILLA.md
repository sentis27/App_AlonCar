# Plantilla: Cómo crear un nuevo workflow

1. **Crear la carpeta:** `workflows/<dominio>/<nombre-del-workflow>/` (nombre en kebab-case, dominio = área de negocio, ej. `operaciones`, `logistica`).
2. **Crear `workflow.json`:** exportar el flujo desde n8n (Menu → Download) y pegarlo tal cual. No editar a mano. Verificar que no contenga credenciales embebidas antes de commitear.
3. **Crear `README.md`** con estas 4 secciones exactas:
   - **Descripción:** qué hace el workflow, en 2-3 líneas, en lenguaje de negocio.
   - **Fuentes de datos:** de dónde lee y a dónde escribe.
   - **Credenciales:** qué credenciales usa, **por nombre/tipo únicamente** (nunca el valor).
   - **Notas de implementación:** decisiones no obvias, limitaciones, TODOs.
4. **Crear `SDD.md`** con estas 4 secciones exactas:
   - **Reglas de negocio:** qué reglas aplica el workflow (validaciones, condiciones, prioridades).
   - **Lógica de procesamiento:** paso a paso de qué transforma/calcula, en orden.
   - **Casos edge:** qué pasa con datos faltantes, duplicados, fuera de rango, errores de origen.
   - **Campos que migran a Supabase:** tabla `campo | tipo de dato | origen (columna Sheets) | notas`.
5. **Registrar en `workflows/_meta/INDEX.md`:** agregar la fila completa (Nombre, Dominio, Estado `desarrollo` si aún no corre en producción, Migración `pendiente`, Dependencias, SDD `pendiente`).
6. **Registrar en `workflows/_meta/migracion.md`:** agregar el workflow y sus campos a la tabla de estado global.

> **REGLA OBLIGATORIA:** Un workflow solo puede marcarse `activo` (sin sufijo) en `INDEX.md` cuando su `SDD.md` esté `completo`. Si un workflow ya corre en producción pero su SDD todavía está `pendiente`, debe listarse como `activo-sin-SDD` — nunca como `activo` a secas. `activo-sin-SDD` es un estado de deuda técnica a resolver, no un estado final.
