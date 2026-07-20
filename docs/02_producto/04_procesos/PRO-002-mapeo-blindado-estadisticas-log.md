---
id: PRO-002
tipo: proceso
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Mapeo blindado de estadísticas y tokens en E8 - EscribirLog

## Cuándo usarlo
Al configurar, modificar o auditar el nodo `E8 - EscribirLog` en el workflow de n8n para asegurar que todas las métricas de consumo del LLM y estadísticas de filas procesadas se escriban sin errores en la pestaña `LOG_PROCESAMIENTO` de Google Sheets.

## Pasos
1. **Abrir la configuración del nodo `E8 - EscribirLog`** en n8n y ubicar la sección `Columns → Value`.
2. **Blindar `salida_agente_texto` con fallback de propiedad OT**:
   `={{ $('E7a - PrepararSheet').first().json.filas?.map(f => f.barco + '|' + (f.orden_trabajo || f.ot_canonica || 'SIN_OT') + '|' + f.contratista).join('; ') }}`
   *(Evita la aparición de la cadena "undefined" cuando una fila no resuelta usa `ot_canonica` en vez de `orden_trabajo`)*.
3. **Mapear explícitamente `total_filas` con evaluación directa**:
   `={{ $('E7a - PrepararSheet').first().json.total_filas || $('E7a - PrepararSheet').first().json.filas?.length || 0 }}`
4. **Mapear explícitamente `filas_review` calculando pendientes**:
   `={{ $('E7a - PrepararSheet').first().json.filas_review || $('E7a - PrepararSheet').first().json.filas?.filter(f => f._needs_review || f.aprobacion === 'R')?.length || 0 }}`
5. **Mapear la suma concatenada de tokens (`tokens_in / tokens_out`)**:
   `={{ ($('E7a - PrepararSheet').first().json._tokens_in || 0) + ' / ' + ($('E7a - PrepararSheet').first().json._tokens_out || 0) }}`

## Resultado esperado
Una fila completamente poblada en la pestaña `LOG_PROCESAMIENTO` de Google Sheets por cada ejecución del webhook, registrando el `mensaje_id`, la fecha, el resumen de texto, los contadores exactos de filas totales/revisadas y la dupla `16909 / 1186` en la columna de tokens.

## Errores comunes
- Asumir que `E7a` propaga automáticamente variables numéricas de `E6` si no se las llama explícitamente en el JSON o si el nodo intermedio de HTTP Request (`GET - LeerColumnaB`) sobrescribe el `$input`.
- Referenciar `f.orden_trabajo` sin alternativa (`||`), lo cual devuelve `undefined` en filas generadas por excepciones o desempates.
