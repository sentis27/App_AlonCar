<!--
  INSTRUCCIONES PARA AGENTES IA — LEER ANTES DE MODIFICAR ESTE ARCHIVO
  
  Este README tiene dos secciones con roles distintos:
  
  SECCIÓN 1 (Línea temporal): Solo lectura. Nunca modificar.
    Generada automáticamente por product-collector al cierre de cada sesión.
    Fuente de verdad cronológica del proyecto.
  
  SECCIÓN 2 (Tablas por tipo): Lectura y escritura.
    Aquí product-collector inserta nuevas entradas.
    Una tabla por tipo. Insertar siempre al FINAL de la tabla correspondiente.
    Nunca reordenar filas existentes.
  
  ASIGNACIÓN DE IDs: No usar este archivo para inferir el último ID.
    Siempre hacer `ls docs/02_producto/[carpeta]/` en el sistema de archivos.
    Este README puede estar desincronizado. El filesystem no miente.
  
  VOCABULARIO CONTROLADO:
    tipo:   decision | error | concepto | proceso | raw
    estado: borrador | validado | pendiente-clasificar | superado
    fase:   1 | 2 | 3
-->

# Catálogo — docs/02_producto/

Bitácora de experiencia del proyecto App_AlonCar.
Captura decisiones, errores, conceptos y procesos del camino real de desarrollo.

---

## Línea temporal  ← SOLO LECTURA. No editar manualmente.

| Fecha | ID | Título | Tipo |
|---|---|---|---|
| 2026-06-10 | DEC-001 | Transporte MCP agnóstico local/VPS | decision |
| 2026-06-10 | ERR-001 | Skills en docs/ vs .agents/skills/ nativo | error |
| 2026-06-10 | CON-001 | Trinidad de una skill real | concepto |
| 2026-06-10 | DEC-002 | Autodescubrimiento heurístico de encabezados | decision |
| 2026-06-10 | ERR-002 | Apps Script bloqueado por Service Account | error |
| 2026-06-10 | CON-002 | Modelo Zero Trust para credenciales | concepto |
| 2026-06-10 | PRO-001 | Configuración de entorno desde cero | proceso |

---

## Decisiones

| ID | Título | Fase | Estado | Fecha |
|---|---|---|---|---|
| DEC-001 | Transporte MCP agnóstico local/VPS | 1 | borrador | 2026-06-10 |
| DEC-002 | Autodescubrimiento heurístico de encabezados | 1 | borrador | 2026-06-10 |

## Errores

| ID | Título | Fase | Estado | Fecha | Corrige a |
|---|---|---|---|---|---|
| ERR-001 | Skills en docs/ vs .agents/skills/ nativo | 1 | borrador | 2026-06-10 | — |
| ERR-002 | Apps Script bloqueado por Service Account | 1 | borrador | 2026-06-10 | — |

## Conceptos

| ID | Título | Fase | Estado | Fecha | Última revisión |
|---|---|---|---|---|---|
| CON-001 | Trinidad de una skill real | 1 | borrador | 2026-06-10 | 2026-06-10 |
| CON-002 | Modelo Zero Trust para credenciales | 1 | borrador | 2026-06-10 | 2026-06-10 |

## Procesos

| ID | Título | Fase | Estado | Fecha | Última revisión |
|---|---|---|---|---|---|
| PRO-001 | Configuración de entorno desde cero | 1 | borrador | 2026-06-10 | 2026-06-10 |

## Raw sin clasificar

| Archivo | Fecha | Días sin clasificar | Estado |
|---|---|---|---|
| _(vacío)_ | — | — | — |

---

<!--
  INSTRUCCIONES DE ESCRITURA PARA product-collector:
  
  Al agregar una entrada nueva:
  1. Insertar fila al FINAL de la tabla del tipo correspondiente.
  2. Insertar fila al FINAL de la tabla "Línea temporal" con fecha de hoy.
  3. Si es una corrección de ERR-, completar la columna "Corrige a" con el ID original.
  4. Si es actualización de CON- o PRO-, actualizar "Última revisión" en la fila existente.
     No agregar fila nueva en la tabla de tipo. Sí agregar en Línea temporal.
  5. Si se aprueba un raw pendiente, moverlo de "Raw sin clasificar" a su tabla destino
     y eliminarlo de la tabla Raw.
  
  Al cambiar estado de una entrada:
  1. Editar solo la columna "Estado" en la fila correspondiente.
  2. No mover la fila. No cambiar el orden.
-->
