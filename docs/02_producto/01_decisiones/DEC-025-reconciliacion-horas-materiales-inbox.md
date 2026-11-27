---
id: DEC-025
tipo: decision
fase: [2]
estado: confirmado
fecha: 2026-08-21
---

# Decisiones de Diseño: Módulo de Reconciliación Automática Horas ↔ Materiales e In-Place Editing

## Contexto
En las planillas legacy `BD_Nuevas_Planillas` y `Imputación horas vs materiales`, la auditoría quincenal previa a la liquidación se realizaba mediante fórmulas `VLOOKUP` con llaves compuestas (`[QUINCENA]/[BARCO].[OT].[CONTRATISTA]`). Cuando un material era retirado sin carga de horas registrada, el supervisor debía realizar un proceso manual desgastante denominado "baile entre planillas" (navegando y editando entre hojas de Materiales, Horas y Alertas).

Asimismo, en la planilla legacy se utilizaba un filtro duro hardcodeado en `IMPORT.MATERIALES` para excluir consumibles administrativos por falta de herramientas de cruce.

## Las Decisiones

### 1. Bandeja de Reconciliación Automática (Reconciliation Inbox)
- Reemplazar las hojas de cruce por un **Panel de Reconciliación en Tiempo Real** en la App.
- El backend ejecutará consultas automáticas relacionando las salidas de pañol (`Consumption`) con las horas registradas (`TimeImput`) y las asignaciones de trabajo (`WorkOrder`) por Barco, OT, Taller y Fecha.

### 2. Regla Unificada de Alerta de Materiales sin Carga de Trabajo
- Eliminar todos los filtros hardcodeados de exclusión.
- **Regla General:** Si cualquier taller o entidad (propia, contratista o servicio externo) retira material de pañol para un Barco/OT pero no existe registro de horas ni asignación de trabajo para ese taller en esa tarea, el sistema emitirá automáticamente una **Alerta de Retiro de Material sin Trabajo Asignado**.

### 3. Acciones Rápidas In-Situ (In-Place Editing)
El panel de reconciliación proveerá 3 acciones inmediatas junto a cada alerta:
1. **✏️ Re-imputar Material:** Permite corregir el Barco o la OT del comprobante de pañol si hubo error del pañolero.
2. **➕ Imputar Horas Faltantes:** Abre el formulario de horas con Barco, OT, Taller y Fecha pre-llenados automáticamente.
3. **🛡️ Marcar Excepción Justificada:** Permite autorizar retiros legítimos sin horas asignando una justificación auditable.

## Consecuencia en la Arquitectura
- Optimización masiva del flujo operativo: reduce el tiempo de auditoría quincenal del supervisor de horas a minutos.
- Garantiza la integridad de costos en el Módulo M3 (Operaciones) y M4 (Logística/Pañol).

---

## Actualización Confirmada (2026-11-27) — Módulo `Control de Gastos`
Tras auditar la planilla viva en producción (`1x7pfn7m2tA8iN1MzVA-my2q0wMSRDHb40tuZQamsYlc`) junto al Controlador de Gastos, se ajustan y confirman estas definiciones funcionales:
- **Módulo dedicado e independiente:** Se implementa como módulo nuevo **`Control de Gastos`**, clasificado **`CARGA_EDICION` (Gallo)** por mutar registros operativos con trazabilidad obligatoria en `audit_logs`.
- **Seguridad y permisos:** Acceso restringido al **Administrador** por defecto, pero indexado dentro de la matriz configurable de permisos (`allowedSections`) para habilitar a terceros cuando se necesite.
- **Conteo y detalle por línea de material:** Cada retiro de pañol (`inventory_transactions`) se muestra y contabiliza como línea individual (sin deduplicar por llave) para reflejar el volumen real pendiente de revisión.
- **Doble vista con criterio asimétrico:**
  - **Materiales sin Horas (alertas principales):** Mesa dividida sincronizada que muestra a la izquierda los retiros con `NO` y a la derecha el espejo de horas del contratista (**qué hizo ese mismo día** + **resumen completo de la quincena en todos los barcos**, contemplando confusiones tanto de OT como de Barco).
  - **Horas sin Materiales (comparador complementario):** Vista secundaria para comparar horas sin consumo de pañol con un **check rápido `✓ Aprobado`** cuando corresponde a trabajos de solo mano de obra.
- **Acción `Desdoblar fila de horas`:** Inserta una fila nueva inmediatamente debajo de la fila del día elegida conservando fecha y operario/contratista, precargando automáticamente el **Barco y la OT copiados desde la línea de material** (con **horas, Barco y OT editables**) y mostrando un **control en vivo de la suma diaria de horas** para no alterar el total liquidado del día.
- **Edición de fecha por salto de quincena (`Fecha ✎`):** Permite corregir la fecha del material (individual o en lote) cuando un vale se carga al día siguiente del cierre de quincena y el contratista ya no continúa ese trabajo, apoyado por un aviso automático del motor indicando si existe coincidencia en la **quincena anterior** (y su último día trabajado).
- **Filtros operativos obligatorios:** Selectores de **Quincena**, **Contratista** (más cola rápida de pendientes) y **Barco** en Zona 1.
- **Talleres sin parte de horas (`workers.can_impute_hours = false`):** Se excluyen automáticamente del cruce con horas (reemplazando las listas hardcodeadas) y pueden auditarse por separado contra `third_party_services` / OTs asignadas.
