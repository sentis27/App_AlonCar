---
id: DEC-013
tipo: decision
fase: fase-2
estado: borrador
fecha: 2026-07-23
---

# Separación estricta de Horas Tabuladas vs Presupuestos Fijos

## Contexto
Durante el mapeo del Resumen Gerencial (GS-004), se definió un nuevo gráfico analítico para cruzar el costo de Hora-Hombre contra el costo de Consumibles y el valor del Dólar en el tiempo.

## La duda
¿Cómo calculamos el "Costo de la Hora-Hombre" de un contratista? ¿Promediamos todo el dinero que se le pagó en la quincena dividido por sus horas registradas?

## La decisión
No. Se definió usar **estrictamente el Valor Tabulado (US$/Hora)** pactado con el contratista. Los trabajos por "presupuesto cerrado" (a destajo) no intervienen en este cálculo y se analizarán en un módulo separado llamado "Avance de Obra".

## Por qué
Promediar los pagos totales (que incluyen trabajos a presupuesto fijo) inflaría irrealmente la tarifa por hora, rompiendo el propósito del gráfico que es detectar cuándo el contratista sube su tarifa plana o si el aumento se debe a inflación/tipo de cambio. Mezclar "peras con manzanas" arruinaría el análisis de rentabilidad pura de la hora.

## Consecuencia
En la futura tabla `RateCard`, debemos diferenciar claramente las tarifas planas por hora. En el código del Dashboard Histórico, las consultas SQL de análisis de Hora-Hombre deben excluir condicionalmente cualquier registro vinculado a "Trabajo por Presupuesto".
