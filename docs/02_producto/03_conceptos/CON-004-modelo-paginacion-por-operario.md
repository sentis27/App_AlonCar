---
id: CON-004
tipo: concepto
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Modelo de Paginación por Operario en Mensajes Múltiples

## En una línea
Estructura conceptual donde la mención del nombre de un operario abre una "página virtual" que agrupa exclusivamente sus tareas subsiguientes.

## Desarrollo
En la operatoria diaria del astillero, es habitual que un supervisor o contratista envíe en un único mensaje de WhatsApp el reporte de varias personas (ejemplo: "Raschines \n Franco r \n Limpieza baradero 1 hs \n Higinio \n Pruebas cal 2 hs \n Pegado burletes 2 hs \n Matias 9 hs"). Si no se impone una frontera estricta de alcance, el LLM o el analizador sintáctico tienden a sufrir fuga de contexto, asignando tareas del operario anterior al siguiente o viceversa.

El **Modelo de Paginación por Operario** define que cada vez que se detecta una línea con el nombre del sujeto (`operario`), se abre una "página de reporte". Todas las líneas con descripciones de tareas, barcos y horas ubicadas debajo pertenecen única y exclusivamente a esa página activa. La aparición de un nuevo nombre de operario actúa como un salto de página incondicional, cerrando la página anterior y abriendo una nueva.

## Por qué importa en este proyecto
Evita la mezcla cruzada de tareas en `App_AlonCar`, garantizando que al procesar mensajes largos con 5 o más operarios y múltiples tareas por persona, la consolidación en `E6 - ConsolidarFilas` impute con precisión quirúrgica cada hora y rubro a su dueño canónico en la planilla.
