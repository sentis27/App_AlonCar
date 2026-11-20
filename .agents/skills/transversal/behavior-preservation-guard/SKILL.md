---
name: behavior-preservation-guard
description: Protocolo anti-regresión y preservación de comportamiento (SKL-018) obligatorio al refactorizar, modularizar o dividir archivos existentes. Impone cirugía mínima, separación Refactor ≠ Feature, Tabla de Paridad (Props/Columnas/Modales/Estados), umbrales por ruta y checkpoints atómicos con rollback.
---

# Blindaje de Preservación Funcional (`SKL-018`)

## Problema general que resuelve

> **La "amputación silenciosa por refactor": cuando un agente divide archivos grandes (`>250L`) o reescribe pantallas y borra columnas, tooltips, aperturas de modal (`isOpen: true`) o transiciones de estado que el usuario ya había probado y aprobado.**

Esta skill complementa a `SKL-017` (Modularidad) y `SKL-007` (Control de Calidad) integrando patrones verificados de preservación de comportamiento:
- **Contrato de Preservación y Pre-Edit Checklist** (patrón `code-refactoring-skill`).
- **Aislamiento de API Pública y Props** (patrón `front-refactor`).
- **Tests de Caracterización Previos al Refactor** (patrón `py-test-quality`).
- **Umbrales por Ruta y Checkpoints con Rollback** (patrón `code-refactoring` v2.0.0).

---

## 0. Cuándo se activa (vía Router `SKL-016`)

- **Siempre** que una tarea implique dividir, extraer o reordenar archivos existentes (`refactor` / modularización).
- **Siempre** que se edite un archivo referenciado en `docs/02_producto/estandares/08_FEATURES_LOCK.md`.
- **Nunca** se carga en ediciones cosméticas triviales (`Nivel 0`) para no consumir tokens innecesarios.

---

## 1. Los 5 Mandatos Inviolables

### M1. Separación Estricta: Refactor Puro ≠ Cambio Funcional
- **Prohibido** mezclar en el mismo paso o commit una partición/modularización de archivos con una funcionalidad nueva o un cambio de reglas de negocio.
- Si el usuario pide arreglar un bug o sumar una función puntual en un archivo `>300L`, aplicar **Cirugía Mínima** (`edit_file` acotado a las líneas del problema) sin reescribir el resto del archivo.

### M2. Inventario Pre-Edición y Tabla de Paridad (Antes vs. Después)
Antes de extraer un subcomponente o dividir un módulo, el agente debe mapear con búsqueda real (`grep` / `Select-String`) todos los puntos de uso y presentar en el chat la **Tabla de Paridad**:

| Elemento del Contrato | Antes (archivo origen) | Después (archivo destino) | Estado |
| :--- | :--- | :--- | :--- |
| Columnas visibles (`<th>`) | Lista exacta de encabezados | Lista exacta idéntica | Paridad 1:1 |
| Props / Callbacks / Modales | Firmas exactas (incl. `isOpen: true`, defaults) | Firmas exactas verificadas | Paridad 1:1 |
| Tooltips / Componentes Canónicos | `CanonicalOtBadge`, `CanonicalMaterialPicker` | Preservados 100% | Paridad 1:1 |
| Transiciones de Estado y Esquema | Valores de `status`, columnas Zod reales | Sin alteración ni columnas trampa | Paridad 1:1 |

### M3. Umbrales Diferenciados por Ruta (`PATH_LINE_THRESHOLDS`)
Verificados automáticamente en `app/scripts/lib/antiRegressionChecks.mjs` vía `npm.cmd run check:hygiene`:
- `app/src/schemas/` y `app/src/repositories/`: **`<= 200 L`**
- `app/src/lib/`, `app/src/hooks/`, `app/src/services/` y `app/src/pages/`: **`<= 250 L`**
- `app/src/components/`: **`<= 300 L`** (evita partir componentes visuales cohesivos en fragmentos artificiales que cortan props o datalists).

### M4. Checkpoints Incrementales y Auto-Rollback
- **Una sola extracción estructural por paso** (prohibidas las "olas masivas" de 15–20 archivos sin verificación intermedia).
- Tras cada extracción correr `npm.cmd run test` + `npm.cmd run build`.
- **Prohibido "parchar hacia adelante":** si un test de contrato de `app/tests/contracts/approvedFeatures.contract.test.js` o el build falla, revertir ese paso antes de reintentar.

### M5. Uso Obligatorio de Componentes Canónicos y `08_FEATURES_LOCK.md`
- **OTs:** toda vista que renderice una Orden de Trabajo usa `app/src/components/canonical/CanonicalOtBadge.jsx` (tooltip flotante garantizado).
- **Materiales:** toda celda o formulario que seleccione materiales usa `app/src/components/canonical/CanonicalMaterialPicker.jsx` (prohibido crear nuevos `<datalist>` crudos de materiales).
- **Funciones aprobadas:** toda funcionalidad aprobada por el usuario se registra en `docs/02_producto/estandares/08_FEATURES_LOCK.md` con su test en `app/tests/contracts/approvedFeatures.contract.test.js`.

---

## 2. Compuerta Obligatoria de Cierre (Candado #4 — Auditoría de `git diff`)

Antes de entregar cualquier cambio:
1. Ejecutar `npm.cmd run check:hygiene` en `app/`.
2. Revisar la salida de `diff guard` (`checkGitDiffDroppedFeatures`). Si reporta `[REGRESIÓN DIFF]` (eliminación de `<th>`, `isOpen: true`, tooltip de OT o `status:`), justificar explícitamente si el usuario pidió quitarlo o restaurarlo de inmediato.
3. Confirmar `features lock: ... OK`, `canónicos: OK` y `vitest` 100% en verde.
