---
name: planificacion-por-etapas
description: Analiza lotes de pedidos del usuario (2 o más tareas, o 1 tarea que toque varias capas), los clasifica por afinidad técnica y dependencia, y propone un plan dividido en etapas verificables antes de escribir código.
---

# Planificación y División por Etapas (SKL-008)

## Problema general que resuelve

> **Ejecutar demasiados cambios distintos en un solo paso dispersa la atención, mezcla causas de fallo y hace imposible verificar con rigor.**

Esta skill evita el trabajo en masa sin estructura. Convierte cualquier lista desordenada de pedidos en una secuencia de etapas donde cada etapa deja el sistema funcionando y pasa por la compuerta de calidad (`SKL-007`).

---

## 0. Cuándo se activa

- Cuando el usuario pide **más de 2 cambios** en un mismo mensaje.
- Cuando un único pedido atraviesa **más de una capa** (por ejemplo: base de datos + servicio + interfaz + panel de administración).
- Cuando el usuario pide explícitamente un plan antes de ejecutar.

---

## 1. Los 5 principios de planificación

### P1. Mapa completo antes de dividir
Antes de proponer etapas se listan **todas** las tareas pedidas (`T1…Tn`) sin omitir ninguna, junto con las tareas pendientes arrastradas de turnos previos (`SKL-007 P2`), identificando qué archivos, tablas y componentes toca cada una.

### P2. Agrupación por afinidad técnica, no por orden de dictado
El usuario describe problemas según cómo usa la pantalla; el ingeniero los agrupa por **acoplamiento técnico** para tocar cada capa de forma limpia y sin mezclar riesgos:
1. **Capa 0 — Chasis, Datos y Esquema:** Docker, variables de entorno, migraciones SQL, permisos e índices.
2. **Capa 1 — Motor Compartido y Contratos:** servicios, repositorios, hooks, motores (`lib/`) y componentes canónicos usados por varios módulos.
3. **Capa 2 — Estructura Visual y Jerarquía:** orden de zonas, textos, etiquetas, colores y columnas visibles de una pantalla.
4. **Capa 3 — Interactividad de Pantalla:** filtros, atajos de teclado, eventos de clic, modales y validaciones de formulario.
5. **Capa 4 — Pantallas Secundarias o de Administración:** ABM de catálogos, paneles de configuración y reportes aislados.

### P3. Orden de cimiento a techo (o de riesgo cero a riesgo alto)
- **Si falta el dato o el contrato:** primero se construye la base (`Capa 0 → Capa 1`) y después la pantalla (`Capa 2 → Capa 3`).
- **Si el dato ya existe y el ajuste es sobre un módulo en uso:** primero se ordena lo visual sin riesgo de romper datos (`Capa 2`), luego la interacción (`Capa 3`) y por último los paneles aislados (`Capa 4`).

### P4. Agrupación por Correlación y Riesgo (Fast-Track)
El límite de una etapa no es un número rígido, sino el riesgo de regresión. 
- **Modo Lote (5-6 tareas):** Si un grupo de tareas afecta exactamente la misma pantalla, el mismo archivo o la misma capa (ej. 5 ajustes visuales y de interacción en una misma tabla), se agrupan en una única etapa porque "quedan a la pasada" y comparten contexto.
- **Modo Quirúrgico (1-2 tareas):** Si las tareas cruzan capas profundas (ej. tocar la base de datos + el backend), se aíslan de inmediato en etapas cortas.
La regla de oro es: se agrupan para maximizar velocidad solo si hacerlas juntas no mezcla dependencias ni rompe el sistema.

### P5. Justificación explícita del orden
Cada etapa declara en una frase **por qué va en esa posición**. Esto hace transparente el criterio técnico y permite al usuario reordenar, aprobar o descartar etapas con información completa.

---

## 2. Procedimiento obligatorio

1. **Inventario (`T1…Tn`):** numerar todos los pedidos del usuario y los arrastrados.
2. **Clasificación:** asignar a cada tarea su Capa (`0` a `4`) y los archivos afectados.
3. **Armado de etapas:** agrupar tareas según correlación y riesgo (P4).
4. **Presentación y Ejecución Dinámica:** Mostrar la tabla del plan. 
   - **Fast-Track:** Si todas las tareas pedidas tienen alta correlación y caben en la Etapa 1 sin cruzar dependencias complejas, presenta el plan e inicia la ejecución de la Etapa 1 **inmediatamente sin esperar autorización**.
   - **Freno por Riesgo:** Si el plan requiere 2 o más etapas porque toca múltiples capas, presenta la tabla y **detente** a esperar autorización antes de codificar la Etapa 1.

---

## 3. Formato obligatorio de la tabla del plan

```markdown
### Plan de Ejecución por Etapas (SKL-008)

| Etapa | Tareas incluidas | Capa | Archivos / Tablas afectados | Por qué va en este orden | Criterio de cierre (SKL-007) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Etapa 1** | T1, T2 | Capa X | ... | ... | ... |
| **Etapa 2** | T3, T4 | Capa Y | ... | ... | ... |
```
