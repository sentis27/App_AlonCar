---
id: DEC-012
tipo: decision
fase: [2]
estado: borrador
fecha: 2026-07-22
---

# Estandarización de la Dimensión Quincenal para Registros y Cierres

## Contexto
En el modelo operativo de la empresa, los ciclos financieros y de control ocurren en períodos quincenales (pago de haberes a operarios, actualización de tarifarios hora-hombre, congelamiento de tipo de cambio dólar y auditoría de consumo de materiales por período).

## La duda
¿Cómo estructurar la dimensión temporal quincenal en la captura de datos para asegurar consistencia en reportes y liquidaciones?

## La decisión
1. **Formato Estándar de Quincena:** Todos los registros en planillas y tablas relacionales (`TimeInput`, `Consumption`, `PurchaseOrder`, etc.) tendrán asociada una quincena con el formato unificado:
   - `1RA [Mes] [Año]` -> Días 1 al 15 del mes (ej: `1RA JUL 2026`).
   - `2DA [Mes] [Año]` -> Días 16 al último día del mes (ej: `2DA JUL 2026`).
2. **Asignación Automática Backend:** La quincena se calculará automáticamente según el día del campo `fecha_registro` (Día <= 15 -> 1RA; Día > 15 -> 2DA), manteniendo la posibilidad de ser consultada o sobreescrita en cierres administrativos si fuese necesario.
3. **Filtro de Análisis y Congelamiento:** Toda vista de reporte, liquidación a contratistas o consolidado de costos permitirá agrupar y filtrar nativamente por el periodo quincenal.

## Por qué
Otorga un criterio unificado para todas las operaciones de la empresa, simplifica los cálculos de liquidación y facilita la congelación periódica de valores sin depender de filtros manuales por rango de fechas.

## Consecuencia
En la base de datos se agregará una columna generada/derivada `quincena_periodo` (o función SQL helper) que compute el string `1RA/2DA MMM YYYY` a partir de la fecha de transacción.
