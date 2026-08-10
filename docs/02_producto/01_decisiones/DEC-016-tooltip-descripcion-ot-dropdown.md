# DEC-016 — Tooltip con Descripción de OT en Dropdown de Selección

> **Estado:** borrador
> **Fase:** 2
> **Fecha:** 2026-08-09
> **Origen:** Decisión del usuario para mejorar la selección correcta de OTs

---

## Contexto

Cuando un usuario selecciona un barco y un contratista, pueden aparecer múltiples OTs del mismo contratista en el mismo barco. Los nombres de las OTs pueden ser similares (ej. "Reparación casco", "Reparación cubierta", "Reparación proa") y el usuario necesita ayuda para elegir la correcta sin equivocarse.

## Decisión

El dropdown de selección de OT debe incluir un **tooltip (hover)** que muestre la descripción completa de la OT al acercar el puntero del mouse.

### Comportamiento Esperado

```
Dropdown: "Seleccionar Orden de Trabajo"
┌──────────────────────────────────────────────────────┐
│   OT-1001 Reparación casco                          │
│   OT-1002 Reparación cubierta                       │
│   OT-1003 Reparación proa         ┌────────────────────────────────────┐
│                        ← hover →  │ OT-1003 Reparación proa            │
│                                    │                                    │
│                                    │ Reparación de fisuras en proa      │
│                                    │ babor, sector 3. Incluye soldadura │
│                                    │ de planchuela y pintura.           │
│                                    │                                    │
│                                    │ Barco: Remolcador Austral          │
│                                    │ Estado: En progreso                │
│                                    │ Inicio: 2026-07-15                 │
│                                    └────────────────────────────────────┘
│   OT-0998 Cambio motor (Terminada)                   │  ← gris, no seleccionable
└──────────────────────────────────────────────────────┘
```

### Datos que muestra el Tooltip
Información proveniente de la vista `work_orders_for_dropdown`:
1. **Título** de la OT (campo `title`)
2. **Descripción completa** (campo `description` — tomado de la planilla Lista de Trabajos en Progreso, GS-003)
3. **Barco** (campo `ship_name`)
4. **Estado** (campo `status` traducido: open → Abierta, in_progress → En progreso, etc.)
5. **Fecha de inicio** (campo `start_date`, si existe)

### Impacto en la Vista SQL
La vista `work_orders_for_dropdown` debe incluir el campo `description` para alimentar el tooltip. Actualmente ya tiene `title`, `ship_name`, `status` — solo falta agregar `description` y `start_date`.

## Dependencias
- Vista `work_orders_for_dropdown` (Tabla de Tablas v3)
- DEC-015 (Interfaz de grilla con edición inline)
- GS-003 Lista de Trabajos en Progreso (fuente de la descripción)
