---
id: DEC-005
tipo: decision
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Eliminación del desdoblamiento automático de horas ante coincidencia múltiple de OTs

## Contexto
Cuando la búsqueda difusa por palabras clave (`findOTporKeywords`) encontraba dos o más Órdenes de Trabajo con el mismo puntaje de coincidencia para una descripción reportada (por ejemplo, "Limpieza baradero" coincidiendo con varias OTs de mantenimiento), el sistema ejecutaba la función `splitHorasEnCuartos`, fraccionando las horas totales y duplicando la fila tantas veces como OTs empatadas existieran.

## La duda
¿Es recomendable que el sistema divida y duplique horas automáticamente entre múltiples OTs empatadas ante descripciones ambiguas en los reportes de WhatsApp?

## La decisión
Eliminar la función de división de horas (`splitHorasEnCuartos`) y la duplicación de filas en `E4b - ValidarRubroYOT`. Cuando exista empate o ambigüedad entre múltiples OTs que habilitan al operario, el sistema generará **1 sola fila** con la totalidad de las horas reportadas, dejará la celda de Orden de Trabajo (`orden_trabajo`) en blanco (`null`), y marcará la fila con `needs_review = true` (`R` roja en planilla).

## Por qué
El reparto automático de horas distorsiona la realidad operativa, generando imputaciones falsas que luego la administración y jefes de obra deben rastrear y desarmar manualmente. Al dejar una única fila con la carga horaria intacta, la celda en blanco y listar todas las candidatas en la columna AE (`[OT: 2 coincidencias por palabras clave (SENTINA, SERVICIO DE LIMPIEZA) — requiere selección manual en planilla]`), el supervisor humana elige la OT correcta con un solo clic en Google Sheets.

## Consecuencia
En `E4b - ValidarRubroYOT`, el array de OTs resueltas (`otsFinales`) queda restringido a 0 o exactamente 1 OT. Si es 0 o ambigua, se emite una sola fila de diagnóstico para revisión humana.
