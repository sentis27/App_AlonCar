# Rollbacks de Migraciones Supabase

Cada migración nueva en `supabase/migrations/` (desde la `0049` en adelante) debe tener su archivo de reversión en esta carpeta. La verificación es automática en `npm.cmd run check:hygiene` (`app/scripts/lib/migrationsManifest.mjs`) y bloquea el cierre si falta.

## Convención

| Migración | Rollback |
| :--- | :--- |
| `supabase/migrations/0049_nombre_descriptivo.sql` | `supabase/rollbacks/0049_nombre_descriptivo.down.sql` |

- Mismo número y mismo nombre, con sufijo `.down.sql`.
- Las migraciones `0001` a `0048` se aplicaron antes de esta política y no exigen rollback retroactivo.
- No se permiten rollbacks huérfanos (sin migración correspondiente) ni huecos o duplicados en la numeración.

## Plantilla

```sql
-- ROLLBACK 00XX: <qué revierte>
-- Riesgo de pérdida de datos: NINGUNO | BAJO | ALTO (explicar qué se pierde)
-- Probado en: <fecha> contra <entorno>
BEGIN;

-- Revertir en orden inverso al de la migración:
-- 1. Restaurar políticas RLS / grants anteriores
-- 2. Quitar triggers y funciones creados
-- 3. Quitar constraints e índices agregados
-- 4. Quitar columnas o tablas nuevas (último paso: es el que pierde datos)

COMMIT;
```

## Reglas

1. El rollback se escribe **junto con** la migración, en el mismo commit.
2. Si revertir implica perder datos (por ejemplo, una columna nueva ya cargada), declararlo en la cabecera `Riesgo de pérdida de datos`.
3. Las migraciones de solo datos (semillas o backfills) documentan cómo restaurar el estado previo o declaran `Rollback no aplicable` con el motivo.
