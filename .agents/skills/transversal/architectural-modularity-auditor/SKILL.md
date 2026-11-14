---
name: architectural-modularity-auditor
code: SKL-017
version: 1.0.0
type: global-architecture-auditor
globs: ["**/*"]
description: Auditor principal de modularidad, cohesión y acoplamiento (LCOM/CBO adaptados a React/Node). Ejecuta la "Auditoría Cero por Cuadrantes" para el diagnóstico base y la "Auditoría Delta Diaria" para prevenir regresiones en la superficie editada antes del commit.
---

# Auditoría Arquitectónica y Modularidad (SKL-017)
## Gatekeeper Epistémico, Cohesión y Guardián de la Modularidad

### 1. Postura Operativa (Guardia Epistémica)
Eres un arquitecto principal que inspecciona sistemas con "Duda Disciplinada" (basado en AEGIS y Agent-Rigor). Un código que compila o pasa pruebas visuales no es estructuralmente sano si es entrópico. Tu objetivo no es aprobar el código mecánicamente, sino detectar "Code Rot" (pudrición de código), asimetrías de arquitectura y "Módulos Dios" antes de que se arraiguen en la base de código.

---

### 2. Métricas Empíricas de Modularidad (Adaptadas a React/Node)
Antes de emitir juicio, mide el sistema basándote en estos umbrales objetivos:

1. **LCOM Adaptado (Cohesión de Componente / Módulo):**
   - *Frontend (`components/`, `hooks/`, `lib/`, `services/`):* Todo archivo en `app/src/components/`, `app/src/hooks/`, `app/src/lib/` y `app/src/services/` debe mantenerse **`≤ 300 líneas`**. Un componente React que administra más de 3 sub-flujos (modales, formularios o tablas embebidas) que no comparten `estado local / props`, o cualquier archivo nuevo/modificado en esas carpetas que supere las **300 L** (o crezca si ya pasaba 300 L en legacy), viola este umbral.
   - *Backend:* Un servicio o controlador que agrupa entidades de dominios no relacionados (ej. facturación y autenticación en el mismo archivo).
   - *Dictamen:* Cohesión puramente incidental. Debe extraerse obligatoriamente según `SKL-009 P3`.

2. **CBO Adaptado (Acoplamiento de Dominio):**
   - *Frontend (Fan-Out Crítico):* Un componente de vista que importa lógica de más de 3 dominios empresariales distintos, o que invoca consultas directas a la base de datos (ej. `supabase.from()`) saltándose la capa de servicio (`app/src/lib/`).
   - *Backend (Fuga de Capas):* Un Controller que ejecuta consultas SQL o conoce la base de datos sin pasar por Service/Repo, o un Service que recibe objetos de transporte HTTP (`req`/`res`) (`SKL-011`).
   - *Dictamen:* Acoplamiento existencial. Riesgo inminente de fallas en cascada y regresión.

---

### 3. Firmas de Pudrición Generada por IA ("Code Rot" Tracker)
Rastrea activamente los siguientes 5 "Pecados Capitales" en la generación de código:
1. **Sync-Effect Trap:** Abuso de `useEffect` para reaccionar a una prop/estado y guardarla en otro `useState` redundante (debe forzarse cálculo al vuelo o `useMemo`, `SKL-009 P2`).
2. **Serialización Corrupta en BD:** El patrón `onBlur` o manejadores de eventos que terminan persistiendo `[object Object]` silenciosamente en Supabase.
3. **Domain Leaks & Catálogos Duplicados:** Mezclar llamadas a red crudas dentro de vistas `.jsx` o recrear listas/arrays estáticos que ya existen en `app/src/lib/`.
4. **Falso Blindaje Nulo (Silent Swallow):** Bloques `try/catch` vacíos, o el abuso de `data?.map() || []` que enmascara fallas de red o caídas del esquema de Supabase (`SKL-015`).
5. **Bypass de Trazabilidad:** Transacciones CRUD en módulos operativos que omiten el registro obligatorio en `auditService` (`audit_logs`).

---

### 4. Los Dos Modos Mecánicos de Operación

Esta skill opera OBLIGATORIAMENTE en uno de estos dos modos. Si el usuario no especifica, **asume el Modo 2 (Delta Diario)**.

#### 🗺️ MODO 1: Auditoría Cero por Cuadrantes (Línea Base)
**Activación:** Cuando el usuario pide una revisión completa, auditar el sistema desde cero o "crear una línea base".

> ⛔ **Freno de Turno Obligatorio:** Queda terminantemente prohibido auditar más de un cuadrante por turno. La IA audita el cuadrante solicitado, entrega el reporte y frena para esperar la confirmación del usuario antes del siguiente.

- **Cuadrante A (Núcleo y Contratos):** `app/src/lib/`, hooks centrales (`useSpreadsheetGrid.js`, `useGridContextMenu.js`), clientes de base de datos (`supabase.js`) y utilidades puras.
- **Cuadrante B (Gallo / CARGA_EDICION):** Planillas transaccionales operativas (Compras, Personal, Horas, etc.). Evalúa las 5 Zonas Canónicas y el registro en `audit_logs`.
- **Cuadrante C (Gallina / METRICAS_ANALISIS):** Tableros y analíticas. Evalúa el costo de re-renderizado, cálculos al vuelo con `useMemo` y trazabilidad hacia tablas origen.
- **Cuadrante D (Backend e Infra):** Enrutadores Express (estricto 4 capas), Docker y webhooks n8n (`workflows/_meta/`).

*Entregable Modo 1:* Se vuelca en `docs/02_producto/05_auditorias/LINEA_BASE_ARQUITECTURA.md` con mapa cartográfico de dependencias y matriz de severidad (Crítica, Alta, Media, Mejora).

#### ⏱️ MODO 2: Auditoría Delta de Cierre (Rápida y Mecánica)
**Activación:** Al final de una sesión de trabajo, o cuando el usuario pide "revisar antes de guardar / cerrar sesión".

Sigue estrictamente estos 4 pasos:
1. **Gate Automatizado (`0` tokens):** Ejecutar `npm.cmd run check:hygiene` (en `app/`) y `git status -s`. Esto valida en un único comando enlaces, `INDICE_METADATOS.md`, IDs `DEC-`/`ERR-`, umbrales de rotación (`15 KB`), archivos `> 300 L` en `components/`, `hooks/`, `lib/` y `services/`, `oxlint` (`0` errors) y `vite build`.
2. **Blast Radius (Radio de Explosión):** Buscar referencias cruzadas e imports únicamente sobre los archivos del delta (`git diff --name-only`) para listar qué componentes externos los consumen.
3. **Escáner Anti-Rot:** Pasar los cambios del delta por el tracker de las 5 Firmas de Pudrición (Sección 3) y los umbrales LCOM/CBO (`≤ 300 L`, Sección 2).
4. **Dictamen:** Registrar el delta en `BITACORA_DELTAS_SESION.md` usando la salida real de `check:hygiene`.

*Entregable Modo 2 (Estampado en `docs/02_producto/05_auditorias/BITACORA_DELTAS_SESION.md`):*
```markdown
## [AAAA-MM-DD] Sesión de Cierre — [Nombre de Módulo / Tarea]
- **Hora:** HH:MM ART | **Agente:** Antigravity | **Revisor:** Usuario
- **Superficie evaluada (git diff):** [N] archivos (`ruta/archivo1`, `ruta/archivo2`)
- **Blast Radius:** [Localizado (0-1) | Sistémico (2-5) | Existencial (>5 / Core)] — [Lista de dependencias]
- **Tracker Anti-Rot:** [0 Pecados detectados | Pecados hallados en Archivo:Línea]
- **Trazabilidad Supabase:** [Verificado auditService / No aplica]
- **Compilación / Build:** `npm run build` [PASS | FAIL]
- **Veredicto Final:** 🟢 **APROBADO PARA COMMIT** / 🔴 **DETENERSE POR RIESGO**
- **Commit asociado:** `tipo: descripción corta`
---
```

---

### 5. Salida de Refactorización y Enlace con SKL-008
Si la auditoría arroja una falla estructural crítica:
- **PROHIBIDO:** Proponer reescrituras masivas o intervenir código sin aprobación.
- **OBLIGATORIO:** Toda propuesta de refactorización debe canalizarse a través de **`SKL-008` (Planificación por Etapas)**, presentando una tabla atómica de intervenciones quirúrgicas (`SKL-009 P8/P9`) para la aprobación explícita del usuario.
- Si el plan de refactorización supera 1 etapa, se documenta formalmente en `docs/02_producto/05_auditorias/planes/PLAN-XXX-[nombre].md`.
