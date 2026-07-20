---
id: PRO-003
tipo: proceso
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Diseño de alertas humanizadas con doble variante en E9a - PrepararRespuesta

## Cuándo usarlo
Al construir o modificar la lógica del nodo `E9a - PrepararRespuesta` en n8n para redactar el mensaje final de confirmación y alerta que se envía vía WhatsApp (`waText`) al usuario que emitió el reporte de horas.

## Pasos
1. **Recopilar filas exitosas agrupadas por Barco**:
   Recorrer el array `data.filas` (procedente de `E7a`). Si el contratista existe y no es placeholder (`[SIN RESUMEN]`), agrupar bajo el nombre del barco (`porBarco[f.barco]`) e imprimir:
   `• ${nombre} (${rubro}) — ${horas} hs ${f._needs_review ? '⚠️' : ''}`.
2. **Evaluar el array de rechazos (`data.tareas_rechazadas`)**:
   Extraer los elementos apartados previamente por `E4a - ValidarOperario` por no corresponder a nombres canónicos del catálogo.
3. **Aplicar bifurcación humanizada de alertas en 2 variantes**:
   - **Variante A (Operario detectado pero no catalogado)**: Si `nr.operario_reportado` contiene texto, formatear la pregunta mostrando qué leyó el sistema para facilitar la corrección:
     `• ¿Quién estuvo en: "${nr.observacion}" (${nr.horas} hs)? (el sistema leyó "${nr.operario_reportado}")`
   - **Variante B (Texto ininteligible o sin sujeto detectable)**: Si `nr.operario_reportado` es nulo o vacío, formatear una pregunta abierta:
     `• No se entendió quién realizó: "${nr.observacion}" (${nr.horas} hs)`
4. **Encabezar y cerrar con llamado a la acción**:
   Iniciar con un check de fecha (`✅ *Registro procesado — ${data.fecha}*`) y cerrar indicando al usuario el siguiente paso operativo (`Por favor confirmar los datos en el grupo para terminar de cargar.`).

## Resultado esperado
Un mensaje altamente legible en WhatsApp que confirma con claridad qué tareas y horas fueron efectivamente escritas en la planilla de Google Sheets (agrupadas limpiamente por barco) y advierte con precisión pedagógica cuáles fueron rebotadas y por qué, acelerando la corrección por parte del operario o supervisor.

## Errores comunes
- Enviar alertas técnicas genéricas (`Error 404 operario no encontrado`) en lugar de mostrar qué texto específico leyó la inteligencia artificial.
- Omitir la agrupación por barco, lo cual dificulta la lectura rápida en pantallas móviles cuando un mensaje contiene reportes para múltiples embarcaciones.
