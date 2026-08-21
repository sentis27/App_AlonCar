---
id: DEC-013
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
