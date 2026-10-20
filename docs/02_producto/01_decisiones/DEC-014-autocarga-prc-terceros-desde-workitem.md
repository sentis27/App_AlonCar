---
id: DEC-014
tipo: decision
fase: fase-2
estado: aprobado
fecha: 2026-10-20
---

# Generación Condicional de PRC $0 en Terceros desde Trabajo (OT), Permiso "3ros" y Doble Observación

## Contexto
En la operación del astillero, los trabajos registrados dentro de una Orden de Trabajo (`work_items`) pueden ser ejecutados por uno o más contratistas/talleres. Cuando un trabajo corresponde a un único proveedor habilitado como Tercero, se requiere evitar la doble carga manual creando automáticamente el registro inicial en el módulo de Terceros en estado Presupuesto (`PRC`) con importe `$0`, vinculando su descripción.

## La decisión
1. **Permiso `3ros` (TERCEROS) en el Padrón de Personal (`/personal`):**
   - En la tabla *"Padrón Operativo de Personas y Talleres"*, dentro de la columna **PERMISOS** (junto a `P` de Pañol y `H` de Horas), se incorpora el permiso con diminutivo **`3ros`** (`can_charge_third_party`), que identifica si el contratista o taller está habilitado para la carga de presupuestos en Terceros.
2. **Condición Estricta para Habilitar la Carga de PRC `$0` a Terceros en la OT:**
   - Un trabajo puede tener uno o varios contratistas asignados (ej. `PINTOR JUAREZ` y `Raschinaje`).
   - El sistema **solo habilita la opción de generar el PRC `$0` en Terceros** cuando se cumplen **ambas condiciones**:
     1. **Un único contratista seleccionado (`contractors.length === 1`):** Si se seleccionan 2 o más contratistas para el mismo trabajo, la opción queda bloqueada/deshabilitada.
     2. **Permiso `3ros` activo en el Padrón:** El único contratista seleccionado debe tener habilitado el permiso **`3ros`** (`can_charge_third_party = true`) en el Padrón Operativo de Personas y Talleres.
3. **Estructura del Registro Generado en Terceros (`third_party_services`) y Doble Observación:**
   - Al confirmarse la opción en el trabajo de la OT, se genera/sincroniza el registro en `public.third_party_services` con:
     - **Estado / Comprobante:** `PRC`
     - **Importe AR$:** `0`
     - **Barco, OT y Contratista:** Heredados del trabajo (`work_item_id`).
   - **Dos tipos de Observaciones en Terceros:**
     1. **Observaciones Directas (`direct_observations`):** Se completan automáticamente con el texto de la `Descripción` del trabajo cargado en la OT y permanecen vinculadas.
     2. **Observaciones Específicas (`specific_observations`):** Campo independiente para notas y observaciones cargadas directamente desde el propio módulo de Terceros.

## Por qué
- **Control operativo sin fricción:** Permite asignar múltiples contratistas en trabajos mixtos cuando corresponde, pero resguarda la integridad contable de Terceros exigiendo un único proveedor con permiso `3ros` activo para disparar un presupuesto `PRC`.
- **Trazabilidad de alcance vs. notas administrativas:** Separar las *Observaciones Directas* (provenientes de la descripción técnica de la OT) de las *Observaciones Específicas* (propias de la negociación/gestión en Terceros) evita pisar información entre áreas.
