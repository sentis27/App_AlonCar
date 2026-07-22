---
id: DEC-011
tipo: decision
fase: [2]
estado: borrador
fecha: 2026-07-22
---

# Flujo de Cierre por Facturación, Archivo Histórico y Preservación de Integriad de Stock

## Contexto
En el sistema legacy, al cerrar y facturar los trabajos de un barco/OT, el usuario debe ejecutar una serie de pasos manuales destructivos:
1. Renombrar manualmente el barco en todas las planillas (ej. `ALTAR` -> `ALTAR 1/2026`).
2. Eliminar el barco de la planilla base (`B.D.NewSystemm` / `BD_NuevasPlanillas`) para sacarlo de los desplegables.
3. Copiar y pegar manualmente los renglones a una planilla de Históricos externa.
4. **Consecuencia grave:** Al mover o alterar las filas legacy, se pierden las referencias de salidas de materiales, corrompiendo el control de stock físico/virtual.

## La duda
¿Cómo gestionar el cierre de OTs facturadas y la vista de Resumen Gerencial sin destruir el control de stock ni realizar tareas manuales de copia y renombramiento?

## La decisión
1. **Cambio de Estado y Data Locking:** Al marcar una OT o Barco como `FACTURADA` / `CERRADA`, el sistema bloquea automáticamente cualquier nueva imputación de horas, materiales o terceros a dicha OT (`ClosureLog` / `M6-cierre`).
2. **Filtrado Automático en Resumen Gerencial Activo:** La pantalla activa de *Resumen Gerencial* (Dashboard activo) filtra de forma nativa las OTs activas/en progreso, excluyendo las facturadas **sin cambiar el nombre del barco ni borrar registros**.
3. **Dashboard Histórico Deductivo:** Se crea un *Dashboard Histórico* con la misma capacidad analítica del Resumen Gerencial, enfocado exclusivamente en consultar obras finalizadas y facturadas.
4. **Preservación Relacional de Stock:** Toda salida de pañol mantiene su vinculación a la tabla `Consumption` y la clave foránea relacional (`work_order_id`), por lo que el stock NUNCA se desajusta ni se pierde al cerrar una OT.

## Por qué
Elimina múltiples horas de trabajo manual riesgoso por quincena/cierre, previene la desincronización y corrupción del inventario de pañol, y garantiza trazabilidad analítica impecable tanto de obras en progreso como históricas.

## Consecuencia
En la base de datos relacional (Supabase), la tabla `WorkOrder` contendrá un enum de estado (`en_progreso`, `facturada`, `archivada`). Las vistas analíticas del Dashboard aplicarán el filtro `WHERE status = 'en_progreso'` para el Resumen Gerencial Activo y `WHERE status = 'facturada'` para el Dashboard Histórico.
