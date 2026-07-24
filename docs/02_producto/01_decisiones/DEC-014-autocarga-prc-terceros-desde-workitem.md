---
id: DEC-014
tipo: decision
fase: fase-2
estado: borrador
fecha: 2026-07-24
---

# Generación Automática de PRC $0 en Terceros desde WorkItem y Regla 1-a-1 de Contratistas

## Contexto
En la operación del astillero, ciertos trabajos registrados en la Lista de Trabajos en Progreso (`WorkItem`) son ejecutados por una sola persona o taller externo (tercero). Actualmente, el usuario debe registrar el trabajo operativamente y luego ir manualmente a la Planilla de Terceros para crear un registro en estado Presupuesto (`PRC`) con costo $0, copiando la descripción y metadatos.

Además, surgía la duda sobre cómo manejar casos donde un trabajo involucra a múltiples contratistas (si se registraban separados por coma en la misma celda).

## La decisión
1. **Regla de Negocio 1-a-1:** Queda prohibida la carga de múltiples contratistas separados por coma en un mismo `WorkItem`. Se establece que **1 WorkItem = 1 Contratista/Taller específico**. Si un trabajo involucra múltiples contratistas o talleres, cada uno debe registrarse en una línea/registro `WorkItem` independiente con su descripción específica.
2. **Generación Automática de PRC:** En la nueva aplicación (Supabase / Web App), al crear o marcar un `WorkItem` asignado a un taller o contratista externo con flag de terceros, la base de datos/backend generará automáticamente un registro vinculado en la tabla `ThirdPartyService` con:
   - Estado: `PRC`
   - Importe AR$: `0`
   - Barco y OT: Heredados del `WorkItem`
   - Proveedor/Contratista: Heredado del `WorkItem` (1-a-1)
   - Observaciones: Copia fiel de la descripción del `WorkItem`

## Por qué
- **Eliminación de trabajo doble:** Se evita que el administrativo tenga que copiar y pegar manualmente la misma información en dos secciones del sistema.
- **Normalización de datos:** La regla 1-a-1 elimina la necesidad de parsear textos libres con comas ("ASTILLERO.CALDERERIA, TECO TALLER"), permitiendo reliquidaciones, métricas y filtrados precisos por proveedor en la base de datos relacional.

## Consecuencia
En la base de datos Supabase, al insertar un `WorkItem` con `is_third_party = true`, un `Database Trigger` o servicio backend creará automáticamente la fila correspondiente en `third_party_services`. En las planillas Legacy no se implementará modificación scripts por decisión de no alterar el entorno previo a la migración.
