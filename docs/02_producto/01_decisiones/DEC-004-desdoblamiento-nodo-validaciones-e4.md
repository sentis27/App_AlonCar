---
id: DEC-004
tipo: decision
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Desdoblamiento del nodo E4 en ValidarOperario (E4a) y ValidarRubroYOT (E4b)

## Contexto
El nodo E4 original (`ValidacionCruzada`) operaba como un bloque monolítico en n8n que ejecutaba de forma simultánea dos tareas críticas pero conceptualmente distintas: la validación anti-alucinación de nombres de operarios/contratistas contra el catálogo oficial, y la deducción difusa de rubros y emparejamiento por palabras clave con Órdenes de Trabajo (OT) activas.

## La duda
¿Conviene mantener una única gran función JavaScript de validación cruzada en E4 o separar la validación canónica de personal de la lógica difusa de rubros y OTs?

## La decisión
Desdoblar E4 en dos nodos independientes dentro de la cadena de n8n:
1. **`E4a - ValidarOperario`**: Recibe las tareas parsed por el LLM (`E3b`) junto al `canal_detectado` (`astillero_general`, `contratista`, `maquinista`). Filtra estricta y quirúrgicamente qué operarios pertenecen al catálogo del canal. Los nombres inventados o no reconocidos son apartados a un array separado (`tareas_rechazadas`) y no avanzan en el flujo hacia las planillas.
2. **`E4b - ValidarRubroYOT`**: Recibe exclusivamente las `tareas_validas` aprobadas por `E4a` para deducir canónicamente el rubro, ejecutar la búsqueda de OTs (por descripción exacta, fuzzy o palabras clave) y aplicar los desempates y flags de revisión (`needs_review`).

## Por qué
Garantiza una arquitectura limpia y auditable (`Separation of Concerns`). Al filtrar primero en `E4a`, aseguramos que ningún operario inválido o alucinado ensucie la búsqueda difusa de OTs ni llegue a Google Sheets (`E7a/E7b`). Además, permite emitir alertas humanizadas personalizadas por WhatsApp (`E9a`) avisando con precisión qué nombres exactos no se pudieron cargar.

## Consecuencia
La arquitectura del flujo principal en n8n queda consolidada como: `Webhook1` → `E1` → `E2` → `E3a (Router)` → `E3b` → `E4a (ValidarOperario)` → `E4b (ValidarRubroYOT)` → `E6 (ConsolidarFilas)` → `E7a` → `E7b` → `E8 (Log)`.
