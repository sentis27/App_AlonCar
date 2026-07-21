---
id: DEC-009
tipo: decision
fase: [2]
estado: borrador
fecha: 2026-07-21
---

# Lógica de Porcentajes Parametrizables de Consumibles por Contratista

## Contexto
En el sistema legacy, el centro de costo para consumibles y elementos de seguridad en `B.D.NewSystemm` se maneja de forma binaria (`SI` / `NO` -> 100% cliente vs 100% contratista). En la práctica comercial existen acuerdos donde a un contratista se le descuenta un porcentaje parcial (ej. 60%) y la diferencia (40%) es absorbida por el cliente/obra.

## La duda
¿Cómo gestionar los descuentos parciales de consumibles evitando la doble imputación manual que se hacía en el sistema legacy (donde se cargaban las diferencias en la planilla de `TERCEROS` como "gastos varios al trabajo")?

## La decisión
1. Reemplazar la regla binaria por un **porcentaje numérico parametrizable** (`porcentaje_descuento_consumibles`) en la entidad de configuración del contratista (`WorkerContract` / `RateCard`).
2. Implementar un **desglose automático de costos** en el backend: ante un retiro de consumibles, el sistema calcula automáticamente la fracción a descontar al contratista en la liquidación quincenal y la fracción restante a imputar como costo directo de la Orden de Trabajo / Barco.
3. Eliminar por completo la carga manual en la planilla o módulo de Terceros para parches de consumibles.

## Por qué
Elimina entre 1.5 y 2 horas quincenales de trabajo manual administrativo propenso a errores, garantiza la trazabilidad de los descuentos frente al contratista y mantiene la exactitud de los costos reales de la obra sin duplicar registros.

## Consecuencia
El modelo de datos relacional de Supabase para `Consumption` incluirá campos derivados o desglosados (`monto_contratista`, `monto_cliente`) calculados dinámicamente según la regla porcentual del contratista a la fecha del retiro.
