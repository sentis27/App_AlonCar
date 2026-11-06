---
name: ergonomia-flujo-visual-senior
description: Marco universal de ergonomía cognitiva y física para el diseño de interfaces. Elimina el mapeo perezoso de datos a pantalla, minimiza el costo de interacción e impone jerarquía mental estricta.
---

# Ergonomía Cognitiva y Física de Interfaces (SKL-012)

## 1. Diagnóstico del Vicio del Agente (El Problema de Raíz)
Por defecto, el modelo de lenguaje comete **4 fallas estructurales** al diseñar interfaces:
1. **Espejado de Base de Datos (1:1 Schema Mapping):** Traduce cada columna o parámetro técnico en un control visual separado, trasladando la complejidad del almacenamiento al usuario humano.
2. **Ceguera Espacial (Efecto Ping-Pong):** Ubica controles interdependientes en extremos opuestos o en orden inverso al pensamiento humano, forzando recorridos erráticos del cursor y la vista.
3. **Amnesia de Frecuencia (Trato Igualitario):** Obliga al usuario a realizar el mismo esfuerzo de búsqueda para el 80% de los casos habituales que para el 20% de los casos excepcionales.
4. **Obediencia Pasiva:** Ejecuta instrucciones literales ineficientes sin advertir el costo operativo acumulado que generarán en el uso diario.

---

## 2. Mandatos Negativos Estrictos (Qué NUNCA volver a hacer)

- **NEVER** fragmentes una única intención del usuario en múltiples controles secuenciales cuando un único control compuesto con filtrado en tiempo real puede resolver la selección en un solo paso.
- **NEVER** inviertas la dirección del flujo de trabajo: el usuario jamás debe retroceder visual o físicamente hacia una zona superior o previa de la pantalla para destrabar, filtrar o completar una acción en una zona inferior.
- **NEVER** separes espacialmente el disparador de una acción del objeto sobre el cual actúa; la distancia entre lectura, edición y confirmación debe tender a cero.
- **NEVER** muestres controles, paneles o campos inactivos/bloqueados que no aplican al contexto actual; lo que no es accionable bajo el estado presente debe ocultarse o transformarse hasta ser requerido.
- **NEVER** exijas abrir un contenedor secundario (modal, pestaña o página aparte) para una operación que puede resolverse en línea (*inline*) sobre el mismo elemento.
- **NEVER** obligues a realizar una consulta o clic adicional para conocer el contenido resumido de un elemento frecuente si puede previsualizarse de forma instantánea en memoria al acercar el foco.
- **NEVER** implementes un diseño que multiplique pasos operativos sin antes desafiar la premisa y presentar al usuario la alternativa de menor fricción.

---

## 3. Matriz de Problemas y Salidas Estructurales (Las Herramientas)

| Síntoma / Problema Detectado | Causa Raíz | Salida Estructural (Solución Universal) |
| :--- | :--- | :--- |
| **Multiplicidad de selectores para llegar a un dato** | Fragmentación de atributos compuestos | **Compresión Dimensional:** Unificar todas las dimensiones de búsqueda en un único selector con filtro de escritura libre y resultados ordenados por relevancia/cronología. |
| **El usuario sube y baja por la pantalla** | Desalineación entre el árbol de decisión mental y el DOM | **Cascada Cognitiva Unidireccional:** Estructurar la vista en 3 estratos invariables: `1. Quién/Qué (Sujeto)` → `2. Bajo qué marco/condición (Contexto)` → `3. Qué se modifica/ejecuta (Acción)`. |
| **Búsqueda repetitiva de los mismos registros recientes** | Ausencia de memoria operativa en la interfaz | **Caché Visual de Alta Frecuencia:** Exponer los $N$ elementos más recientes o frecuentes como disparadores directos de 1 clic con previsualización instantánea sin latencia. |
| **Saturación visual por opciones condicionales** | Exposición prematura de toda la lógica del sistema | **Divulgación Progresiva (Progressive Disclosure):** Mostrar únicamente el nivel de decisión activo; desplegar sub-controles en línea sólo cuando la selección padre lo exige. |
| **Fatiga en carga repetitiva o masiva de datos** | Dependencia exclusiva del puntero (mouse) | **Flujo de Teclado Continuo:** Garantizar que el ciclo completo (foco → entrada → salto al siguiente campo → confirmación) sea ejecutable 100% mediante teclado sin soltar las manos. |
| **Fricción para crear un registro correlativo nuevo** | Falta de inferencia del sistema | **Autocompletado Predictivo:** Al iniciar una creación, el sistema debe deducir y pre-cargar el siguiente estado lógico probable y heredar los valores base del estado inmediato anterior. |

---

## 4. Adaptabilidad según el Vector de Operación

1. **Según el Dispositivo y Entorno:**
   - **Operación Intensiva de Escritorio (Carga/Gestión):** Prioridad absoluta al teclado, alta densidad informativa, cero animaciones lentas, edición directa en grilla.
   - **Operación de Campo / Móvil:** Inversión de la jerarquía espacial; acciones primarias en la zona inferior de alcance del pulgar, objetivos táctiles amplios y mínima escritura manual.

2. **Según el Propósito Cognitivo:**
   - **Modo Transaccional (Gallo / Carga y Edición):** El flujo es `Definir Contexto → Ingresar Valor → Persistir`. Cero distracciones analíticas.
   - **Modo Analítico (Gallina / Diagnóstico y Control):** El flujo es `Visión Macro (Estado/Semáforo) → Detección de Desvío → Foco en el Detalle (Drill-down)`.

---

## 5. Freno de Auditoría Pre-Código (Protocolo de Verificación)

1. **Test del Vector Único:** Traza una línea imaginaria siguiendo el orden en que el usuario hará clic o presionará `Tab`. Si la línea se cruza a sí misma o retrocede hacia arriba, **el diseño es inválido y debe reestructurarse**.
2. **Test de Compresión ($N \to 1$):** Por cada grupo de controles que trabajen juntos, pregunta: *¿Puedo fusionar estos $N$ pasos en 1 solo control inteligente?*
3. **Test de Estado Vacío/Por Defecto:** Al abrir la pantalla sin tocar nada, ¿el sistema ya está posicionado en el escenario más probable (el 80% de los casos), o fuerza al usuario a configurar todo desde cero?
