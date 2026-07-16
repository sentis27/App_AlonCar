# Plantilla: Cómo crear un nuevo workflow

1. **Crear la carpeta:** `workflows/<dominio>/<nombre-del-workflow>/` (nombre en kebab-case, dominio = área de negocio, ej. `operaciones`, `logistica`).
2. **Crear `workflow.json`:** exportar el flujo desde n8n (Menu → Download) y pegarlo tal cual. No editar a mano. Verificar que no contenga credenciales embebidas antes de commitear.
3. **Crear `README.md`** con estas 4 secciones exactas:
   - **Descripción:** qué hace el workflow, en 2-3 líneas, en lenguaje de negocio.
   - **Fuentes de datos:** de dónde lee y a dónde escribe.
   - **Credenciales:** qué credenciales usa, **por nombre/tipo únicamente** (nunca el valor).
   - **Notas de implementación:** decisiones no obvias, limitaciones, TODOs.
4. **Crear `SDD.md`** con esta estructura estándar (secciones 1-14 obligatorias, orden fijo):

   1. **Objetivo del flujo** — *Qué resultado de negocio produce este workflow, en una oración.*
   2. **Problema de negocio que resuelve** — *Qué ineficiencia o dolor existía antes de este workflow.*
   3. **Contexto operacional** — *Quién lo usa, cuándo se dispara, con qué frecuencia.*
   4. **Alcance (dentro / fuera de alcance)** — *Qué cubre explícitamente y qué queda deliberadamente afuera.*
   5. **Entradas del sistema** — *Qué datos/eventos dispara el flujo: origen, formato, trigger.*
   6. **Salidas del sistema** — *Qué produce el flujo: destino, formato, efectos secundarios.*
   7. **Reglas de negocio** — *Validaciones, condiciones y prioridades que aplica el flujo.*
   8. **Flujo lógico operacional** — *Secuencia de pasos, en orden, de principio a fin.*
   9. **Estructura de datos** — *Campos, tipo de dato y origen de cada uno.*
   10. **Relaciones entre entidades** — *Cómo se vinculan las entidades: claves, cardinalidad.*
   11. **Manejo de errores** — *Qué pasa ante datos faltantes, duplicados, fuera de rango, fallos de origen.*
   12. **Dependencias críticas** — *Qué otros sistemas, flujos o tablas deben existir para que esto funcione.*
   13. **Escalabilidad futura** — *Qué cambiaría si crece el volumen o el alcance.*
   14. **Lecciones de implementación** — *Qué se aprendió construyendo/manteniendo el flujo; qué no repetir.*

   **Secciones opcionales** (solo para workflows complejos, agregar al final si aplica):
   - **KPIs** — *Métricas que miden si el flujo cumple su objetivo.*
   - **Riesgos operativos** — *Qué puede fallar en producción y su impacto.*
   - **Recomendaciones arquitectónicas** — *Cambios de diseño sugeridos a futuro.*
   - **Anexos** — *Material de referencia adicional: capturas, links, versiones previas.*

5. **Registrar en `workflows/_meta/INDEX.md`:** agregar la fila completa (Nombre, Dominio, Estado `desarrollo` si aún no corre en producción, Migración `pendiente`, Dependencias, SDD `pendiente`).
6. **Registrar en `workflows/_meta/migracion.md`:** agregar el workflow y sus campos a la tabla de estado global.

> **REGLA OBLIGATORIA:** Un workflow solo puede marcarse `activo` (sin sufijo) en `INDEX.md` cuando su `SDD.md` esté `completo` (las 14 secciones obligatorias llenas). Si un workflow ya corre en producción pero su SDD todavía está `pendiente`, debe listarse como `activo-sin-SDD` — nunca como `activo` a secas. `activo-sin-SDD` es un estado de deuda técnica a resolver, no un estado final.
