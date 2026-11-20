---
name: piezas-replicables-solucion
description: Gobernanza obligatoria (SKL-019) cuando el usuario pide estandarizar, replicar o crear una pieza transversal reutilizable. Impone Entrevista Inteligente de Solución (preguntas de negocio y sugerencias proactivas de datos antes de programar) y arquitectura en 3 Capas Soldadas (Datos Únicos + Reglas Únicas + UI Única) con candado mecánico en check:hygiene.
---

# Piezas Replicables y Diseño Orientado a Soluciones (`SKL-019`)

## Principio Rector

> **No programar funciones sueltas: diseñar soluciones replicables que evolucionen en un solo lugar.**  
> Cuando el usuario pide *"estandarizar"*, *"replicar"*, *"crear una pieza común"* o *"que aparezca siempre cuando ocurra X"*, el objetivo es construir una **pieza maestra única** donde cualquier mejora futura se acumule una sola vez y se propague automáticamente al 100% de los módulos que dependen de ella.

---

## 0. Cuándo se activa (vía Router `SKL-016` en `GEMINI.md`)

- **Siempre** que el usuario diga: *"estandarizar"*, *"replicar"*, *"pieza replicable"*, *"componente canónico"*, *"menú/cartel/selector común"*, *"que funcione igual en todos los módulos"* o *"que aparezca siempre cuando..."*.
- **Siempre** que un patrón visual o funcional vaya a usarse en **2 o más módulos** del ERP.
- **Carácter:** **BLOQUEANTE antes de escribir código o proponer una arquitectura cerrada.**

---

## 1. Fase 0 Obligatoria — Entrevista Inteligente de Solución (Antes de Codificar)

Antes de diseñar o escribir código, el agente debe hacer una **inspección rápida de las tablas/columnas reales involucradas** (`SKL-014`) y presentarle al usuario **4 a 5 preguntas concretas de negocio** (en lenguaje simple + sugerencias proactivas), cubriendo estas 5 dimensiones:

1. **Para qué decisión real sirve (Intención de negocio):**
   - *¿Quién en el astillero/taller la va a ver (Pañol, Compras, Jefes de Obra, Dirección) y qué decisión rápida necesita tomar en 3 segundos al usarla?*
2. **Cuándo y dónde se dispara (y dónde NO):**
   - *¿En qué módulos, grillas, tarjetas, modales o estados debe aparecer siempre? ¿Qué debe mostrar cuando falta un dato (ej. `Sin OT`, `Sin precio`, `Sin stock`, registro cerrado)?*
3. **Qué datos necesita traer — con sugerencias proactivas del agente:**
   - El agente **NO se limita a repetir lo que dijo el usuario**: revisa las columnas reales de Supabase y **sugiere datos útiles que el usuario pudo haber pasado por alto** (ejemplo: *"Además de descripción y contratista, la tabla también tiene estado, jefe de obra y fecha estimada: ¿querés verlos y distinguir visualmente los cerrados?"*).
4. **Ayuda visual y comportamiento esperado:**
   - *¿Qué debe resaltarse, tacharse, alertarse con color o ícono (`❌`, semáforo, badge)? ¿Solo informa al pasar el mouse o también dispara una acción rápida?*
5. **Evolución futura esperada:**
   - *¿Qué reglas o campos de esta pieza suelen cambiar seguido para dejarlos concentrados en un único motor fácil de ajustar?*

> **Regla de comunicación (`GEMINI.md §5`):** Todas las preguntas y sugerencias se redactan en lenguaje claro de operación naval/taller (acompañando cualquier término técnico con su traducción `🔧 Técnico` / `💡 En simple`).

---

## 2. Arquitectura Inviolable — Las 3 Capas Soldadas + Candado

**Prohibido estandarizar solo la cáscara visual (JSX) dejando consultas `select` recortadas o reglas duplicadas por módulo.** Toda pieza replicable se construye como un paquete cerrado de 3 capas más su candado automático:

| Capa | Ubicación | Mandato Obligatorio | Ejemplo real (`CanonicalOtBadge`) |
| :--- | :--- | :--- | :--- |
| **Capa 1 — Datos Únicos** | `app/src/repositories/` | Exponer un `*_CANONICAL_SELECT` y un método `listCanonical...()` que traiga el 100% de las columnas que la pieza necesita. **Ningún servicio puede recortar el `select` a mano.** | `workOrdersRepository.listCanonicalWorkOrders()` y `workItemsRepository.listCanonicalWorkItems()` |
| **Capa 2 — Motor de Reglas Único** | `app/src/lib/` | Centralizar toda lógica, estados cerrados, cálculos y formateos en una sola función pura. Un cambio aquí impacta en el 100% del ERP en el acto. | `isClosedWorkItemStatus()` + `formatWorkOrderTooltipCanonical()` + `buildCanonicalOtBadgeData()` |
| **Capa 3 — Pieza Visual Única** | `app/src/components/canonical/` | Un único componente visual reutilizado en el 100% de los módulos aplicables (sin copias pintadas a mano en grillas o modales). | `CanonicalOtBadge.jsx`, `CanonicalMaterialPicker.jsx` |
| **Capa 4 — Candado Mecánico** | `antiRegressionChecks.mjs` + `08_FEATURES_LOCK.md` + `approvedFeatures.contract.test.js` | Agregar verificación automática en `check:hygiene` (que falle en rojo si un módulo recorta columnas o saltea el componente) y contrato `FL-NNN` blindado en Vitest. | `FL-002`, `FL-003`, `FL-015`..`FL-019` |

---

## 3. Regla de Mantenimiento Acumulativo

Cuando el usuario pida mejorar o corregir una pieza ya estandarizada:
1. Modificar **únicamente** la Capa 1 (si suma un dato), Capa 2 (si cambia una regla/texto) o Capa 3 (si cambia el diseño).
2. Verificar con búsqueda global (`Select-String`) que ningún módulo tenga copias viejas ni `select` recortados fuera de la pieza maestra.
3. Actualizar el contrato `FL-NNN` en `approvedFeatures.contract.test.js` y confirmar `npm.cmd run check:hygiene` en verde.
