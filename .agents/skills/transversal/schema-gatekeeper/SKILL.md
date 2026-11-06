---
name: schema-gatekeeper
description: Candado cognitivo contra la invención o asunción de memoria de estructuras de datos, módulos y contratos. Exige verificación empírica previa a cualquier propuesta o edición.
---

# Freno de Inspección Empírica y Cero Asunciones (SKL-014)

## 1. Diagnóstico del Vicio del Agente (El Problema de Raíz)
El modelo de lenguaje padece **3 sesgos de memoria estadística**:
1. **Autocompletado Plausible pero Falso:** Cuando no conoce el nombre exacto de un atributo, tabla o función, deduce el nombre "más probable" según estándares genéricos de la industria, introduciendo referencias inexistentes que rompen en tiempo de ejecución.
2. **Ceguera de Alcance Transversal:** Cuando el usuario pide aplicar una regla "a todo el sistema", el agente enumera de memoria sólo los módulos que recuerda de los últimos turnos, omitiendo el resto de la arquitectura real.
3. **Impulso de Escritura Prematura:** Intenta modificar archivos o proponer planes de trabajo en el primer paso sin haber ejecutado antes herramientas de lectura para comprobar el estado físico real del repositorio y de la base de datos.

---

## 2. Mandatos Negativos Estrictos (Qué NUNCA volver a hacer)

- **NEVER** utilices tu memoria conversacional para enumerar módulos, vistas, entidades o tablas del sistema; consulta siempre primero el índice maestro de arquitectura.
- **NEVER** escribas el nombre de una entidad, columna, clave primaria, relación o propiedad en el código sin haber verificado empíricamente su existencia exacta en la fuente de verdad durante la sesión activa.
- **NEVER** inicies un turno de implementación invocando herramientas de creación o edición de archivos antes de haber ejecutado herramientas de inspección y lectura.
- **NEVER** asumas que un catálogo o lista de opciones es estático o local; verifica siempre si otra parte del sistema ya lo consume desde una fuente compartida o base de datos.
- **NEVER** propongas un plan arquitectónico transversal sin cruzarlo contra la totalidad del padrón de componentes transaccionales y analíticos del proyecto.

---

## 3. Matriz de Problemas y Salidas Estructurales (Las Herramientas)

| Síntoma / Problema Detectado | Causa Raíz | Salida Estructural (Solución Universal) |
| :--- | :--- | :--- |
| **Errores por columnas o tablas inexistentes** | Deducción por intuición semántica | **Sondeo Empírico Pre-Vuelo (Schema Probe):** Consultar el diccionario de contratos verificados o ejecutar una lectura real de 1 registro contra el motor de datos para extraer las claves reales antes de codificar. |
| **Soluciones parciales que olvidan módulos del sistema** | Trabajo basado en memoria de corto plazo | **Barrido contra Padrón Maestro:** Lectura obligatoria del índice oficial de clasificación de módulos y submódulos antes de emitir cualquier diagnóstico, lista o plan de alcance global. |
| **Duplicación de lógica o fuentes de datos** | Desconocimiento de componentes preexistentes | **Rastreo de Consumo Existente:** Antes de crear una consulta o estado, buscar en el código cómo resuelven ese mismo dominio los módulos adyacentes para reutilizar el mismo contrato. |
| **Desfase entre un cambio nuevo y la documentación** | Evolución del código sin actualizar el mapa | **Sincronización de Contrato Inmediata:** Toda alta o modificación de entidad, vista o herramienta analítica exige actualizar en el mismo acto el índice estructural que la gobierna. |

---

## 4. Freno de Auditoría Pre-Código (Protocolo de Verificación)
1. **Declaración de Evidencia Fáctica:** Antes de tocar código o presentar un plan, el agente debe poder responder con certeza verificada: *¿Qué archivo índice leí? ¿Qué entidades físicas consulté? ¿Cuáles son los nombres exactos de sus atributos reales?* Si alguna respuesta es "asumo que...", **se detiene la ejecución y se inspecciona primero**.
