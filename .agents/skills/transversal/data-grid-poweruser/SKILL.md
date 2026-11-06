---
name: data-grid-poweruser
description: Gobernanza para interfaces de alta densidad tabular y carga intensiva. Impone navegación espacial por teclado, mutación in-situ, operaciones matriciales y reversibilidad sin interrupciones.
---

# Protocolo de Grilla Industrial y Operación por Teclado (SKL-013)

## 1. Diagnóstico del Vicio del Agente (El Problema de Raíz)
Al construir vistas tabulares, el modelo de lenguaje comete **4 fallas por defecto**:
1. **Pasividad Tabular:** Trata las tablas como superficies muertas de solo lectura y delega toda edición a formularios externos o ventanas emergentes, multiplicando el tiempo operativo por cada celda.
2. **Dependencia del Puntero:** Exige precisión visual con el mouse para posicionar el foco, ignorando que en la carga intensiva el cambio constante entre teclado y mouse destruye la velocidad del operador.
3. **Fricción por Confirmación:** Interrumpe el flujo cognitivo con diálogos modales de confirmación en lugar de ofrecer ejecución inmediata respaldada por una pila de reversión (*Undo/Redo*).
4. **Aislamiento de Celda Única:** Procesa los datos de forma unitaria, impidiendo operar sobre rangos, bloques contiguos o matrices provenientes del portapapeles.

---

## 2. Mandatos Negativos Estrictos (Qué NUNCA volver a hacer)

- **NEVER** construyas una vista de datos transaccionales como una tabla estática desconectada del motor central de hoja de cálculo del sistema.
- **NEVER** obligues a abrir un contenedor emergente para modificar un valor escalar o seleccionable que puede mutarse directamente sobre la propia coordenada de la celda.
- **NEVER** atrapes ni pierdas el foco del teclado tras confirmar un valor; la confirmación debe desplazar el foco de manera predecible hacia la siguiente coordenada lógica.
- **NEVER** interrumpas al usuario con alertas de confirmación para acciones cotidianas que pueden revertirse mediante el historial de deshacer en memoria.
- **NEVER** proceses el pegado de datos como texto plano dentro de un único campo cuando el portapapeles contiene una estructura bidimensional (filas por columnas).
- **NEVER** implementes lógica de selección, copiado, pegado o historial de forma aislada dentro de una vista particular; toda mejora tabular debe vivir en el motor compartido.

---

## 3. Matriz de Problemas y Salidas Estructurales (Las Herramientas)

| Síntoma / Problema Detectado | Causa Raíz | Salida Estructural (Solución Universal) |
| :--- | :--- | :--- |
| **Lentitud al modificar múltiples registros consecutivos** | Ciclo abrir-editar-guardar-cerrar por registro | **Mutación In-Situ Continua:** Activación directa de celda por teclado o doble pulso, confirmación instantánea al salir o avanzar y persistencia asíncrona en segundo plano. |
| **Pérdida de ritmo al navegar entre filas y columnas** | Ausencia de coordenadas espaciales | **Matriz de Coordenadas Direccional:** Navegación bidimensional completa por teclado (desplazamiento ortogonal, salto de línea y retorno inverso) manteniendo siempre visible el indicador de coordenada activa. |
| **Carga manual repetitiva desde fuentes externas** | Ingreso celda por celda | **Ingesta Matricial 2D y Propagación:** Deserialización automática del portapapeles en filas/columnas con sanitización de tipos y arrastre vectorial para replicar valores en celdas adyacentes. |
| **Temor al error en ediciones rápidas o masivas** | Mutaciones destructivas sin retorno | **Pila de Reversión Multinivel (Undo/Redo):** Captura de instantáneas previas a cada mutación individual o por lote, permitiendo restaurar el estado exacto con un atajo de teclado. |
| **Falta de contexto cuantitativo al seleccionar datos** | Selección meramente decorativa | **Agregación Reactiva de Selección:** Cálculo instantáneo en barra de estado (sumatoria, promedio, recuento y acciones por lote) sobre cualquier subconjunto de filas o celdas activas. |

---

## 4. Freno de Auditoría Pre-Código (Protocolo de Verificación)
1. **Test de Manos en el Teclado:** ¿Puede el operador recorrer la grilla, editar 10 celdas, pegar una matriz externa y deshacer el último cambio sin tocar el mouse una sola vez?
2. **Test de Herencia Canónica:** ¿La vista consume el motor tabular centralizado y sus componentes satélites (cinta superior, menú contextual, barra inferior y columna índice), o está reescribiendo comportamiento local?
