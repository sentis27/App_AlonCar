# Índice de Workflows n8n

Tabla maestra de todos los workflows de automatización. Actualizar esta tabla cada vez que se crea o cambia de estado un workflow.

| Nombre | Dominio | Estado | Migración Sheets→Supabase | Dependencias | SDD |
|---|---|---|---|---|---|
| reporte-ordenes-trabajo | operaciones | activo | pendiente | — | completo |
| reporte-horas | operaciones | activo | pendiente | — | completo |

**Estado:** `activo` (corriendo en producción, SDD completo) / `activo-sin-SDD` (corriendo en producción, SDD pendiente) / `desarrollo` (en construcción, no productivo)
**Migración Sheets→Supabase:** `pendiente` / `en curso` / `completo`
**SDD:** `pendiente` / `completo` — un workflow solo puede figurar como `activo` (sin el sufijo) cuando su SDD esté `completo`. Mientras el SDD esté `pendiente`, un workflow en producción debe listarse como `activo-sin-SDD`, nunca como `activo` a secas (ver `PLANTILLA.md`).
