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
| 2026-06-10 | DEC-003 | Separación de Índice Humano vs Tabla Máquina | decision |
| 2026-06-10 | CON-003 | Arquitectura de la Bitácora de Producto | concepto |
| 2026-06-14 | ERR-003 | Google Sheets API: The caller does not have permission | error |
| 2026-07-19 | DEC-004 | Desdoblamiento del nodo E4 en ValidarOperario y ValidarRubroYOT | decision |
| 2026-07-19 | DEC-005 | Eliminación del desdoblamiento automático de horas en OTs ambiguas | decision |
| 2026-07-19 | DEC-006 | Lógica determinística en 4 reglas para E3a (Router v2.3) y filtrado de catálogos | decision |
| 2026-07-19 | DEC-007 | Blindaje anti-alucinaciones en Set - PromptConfig vs. parches JS | decision |
| 2026-07-19 | DEC-008 | Enrutamiento de WhatsApp por participantPn al teléfono emisor | decision |
| 2026-07-19 | CON-004 | Modelo de paginación por operario en mensajes múltiples | concepto |
| 2026-07-19 | PRO-002 | Mapeo blindado de estadísticas y tokens en E8 - EscribirLog | proceso |
| 2026-07-19 | PRO-003 | Diseño de alertas humanizadas con doble variante en E9a | proceso |
| 2026-07-21 | DEC-009 | Lógica de porcentajes parametrizables de consumibles por contratista | decision |
| 2026-07-21 | DEC-010 | Terminal de Pañol con verificación visual y ocultamiento de costos por rol | decision |
| 2026-07-22 | DEC-011 | Flujo de Cierre por Facturación, Archivo Histórico y Preservación de Integridad de Stock | decision |
| 2026-07-22 | DEC-012 | Estandarización de la Dimensión Quincenal para Registros y Cierres | decision |
| 2026-07-23 | DEC-013 | Separación estricta de Horas Tabuladas vs Presupuestos Fijos | decision |

---

## Decisiones

| ID | Título | Fase | Estado | Fecha |
|---|---|---|---|---|
| DEC-001 | Transporte MCP agnóstico local/VPS | 1 | borrador | 2026-06-10 |
| DEC-002 | Autodescubrimiento heurístico de encabezados | 1 | borrador | 2026-06-10 |
| DEC-003 | Separación de Índice Humano vs Tabla Máquina | 1 | borrador | 2026-06-10 |
| DEC-004 | Desdoblamiento del nodo E4 en ValidarOperario y ValidarRubroYOT | 1 | borrador | 2026-07-19 |
| DEC-005 | Eliminación del desdoblamiento automático de horas en OTs ambiguas | 1 | borrador | 2026-07-19 |
| DEC-006 | Lógica determinística en 4 reglas para E3a (Router v2.3) y filtrado de catálogos | 1 | borrador | 2026-07-19 |
| DEC-007 | Blindaje anti-alucinaciones en Set - PromptConfig vs. parches JS | 1 | borrador | 2026-07-19 |
| DEC-008 | Enrutamiento de WhatsApp por participantPn al teléfono emisor | 1 | borrador | 2026-07-19 |
| DEC-009 | Lógica de porcentajes parametrizables de consumibles por contratista | 2 | borrador | 2026-07-21 |
| DEC-010 | Terminal de Pañol con verificación visual y ocultamiento de costos por rol | 2 | borrador | 2026-07-21 |
| DEC-011 | Flujo de Cierre por Facturación, Archivo Histórico y Preservación de Integridad de Stock | 2 | borrador | 2026-07-22 |
| DEC-012 | Estandarización de la Dimensión Quincenal para Registros y Cierres | 2 | borrador | 2026-07-22 |
| DEC-013 | Separación estricta de Horas Tabuladas vs Presupuestos Fijos | 2 | borrador | 2026-07-23 |

## Errores

| ID | Título | Fase | Estado | Fecha | Corrige a |
|---|---|---|---|---|---|
| ERR-001 | Skills en docs/ vs .agents/skills/ nativo | 1 | borrador | 2026-06-10 | — |
| ERR-002 | Apps Script bloqueado por Service Account | 1 | borrador | 2026-06-10 | — |
| ERR-003 | Google Sheets API: The caller does not have permission | 1 | borrador | 2026-06-14 | — |

## Conceptos

| ID | Título | Fase | Estado | Fecha | Última revisión |
|---|---|---|---|---|---|
| CON-001 | Trinidad de una skill real | 1 | borrador | 2026-06-10 | 2026-06-10 |
| CON-002 | Modelo Zero Trust para credenciales | 1 | borrador | 2026-06-10 | 2026-06-10 |
| CON-003 | Arquitectura de la Bitácora de Producto | 1 | borrador | 2026-06-10 | 2026-06-10 |
| CON-004 | Modelo de paginación por operario en mensajes múltiples | 1 | borrador | 2026-07-19 | 2026-07-19 |

## Procesos

| ID | Título | Fase | Estado | Fecha | Última revisión |
|---|---|---|---|---|---|
| PRO-001 | Configuración de entorno desde cero | 1 | borrador | 2026-06-10 | 2026-06-10 |
| PRO-002 | Mapeo blindado de estadísticas y tokens en E8 - EscribirLog | 1 | borrador | 2026-07-19 | 2026-07-19 |
| PRO-003 | Diseño de alertas humanizadas con doble variante en E9a | 1 | borrador | 2026-07-19 | 2026-07-19 |

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
