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
- **NEVER** utilices iconos, glifos o símbolos de estado (candados, alertas, escudos, checks) sin un tooltip explícito (atributo 'title' o componente flotante) que comunique inequívocamente su significado funcional de negocio; previene que el usuario infiera restricciones personales o sanciones cuando se trata de protecciones contables o de integridad de datos.
- **NEVER** ocultes, desplaces ni permitas que el buscador omnicanal (`CrawlerSearchBar`) desaparezca de la vista del operario al descender en los datos de una planilla, ni que la Zona 3 se superponga o trague la cabecera de la Zona 4 (`GridRibbon` + `thead`). Zona 3 y Zona 4 deben viajar solidarias dentro de `.alon-workspace-block` (`sticky top-0 z-20 flex flex-col gap-2.5`), con el desplazamiento vertical confinado exclusivamente a `.alon-grid-scroll` (`max-h-[calc(100vh-340px)]`).
- **NEVER** diseñes submenús o modales de carga como formularios largos de una sola columna (`max-w-lg` o `max-w-2xl`) que superen la altura de la pantalla y obliguen al operario a hacer scroll vertical para encontrar los campos o el botón de guardado. Todo modal de carga con 4+ campos debe usar la estructura bicolumna canónica (`.alon-modal-card` `max-w-5xl`, `.alon-modal-header`, `.alon-modal-body`, `.alon-modal-footer` fijo) subdividida en bloques cromáticos (**Chroma-Chunking**) y con recorrido limpio por tecla `Tab` (`tabIndex={-1}` en píldoras y botones secundarios).
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
| **Ambigüedad o malinterpretación de símbolos e íconos** | Sobrecarga semántica en iconografía genérica (ej. candado = ¿sanción al operario o período histórico cerrado?) | **Iconografía Auto-explicativa con Tooltips Semánticos:** Todo icono o glifo de estado debe contar obligatoriamente con un tooltip contextual claro (`title` o componente emergente) que aclare el motivo técnico y descarte interpretaciones erróneas sobre el personal o la entidad. |
| **Pérdida del buscador o solapamiento de Zona 3 sobre títulos de grilla** | Desborde del presupuesto vertical del contenedor padre (`Height(Zona 3 + Zona 4 + pb) > Height(<main>)`) o uso de `sticky` sin acotar la altura del contenedor de scroll | **Bloque Operativo Unificado con Presupuesto de Viewport (`.alon-workspace-block` + `.alon-grid-scroll`):** Envolver Zona 3 y Zona 4 como **un solo bloque indivisible** en `.alon-workspace-block` (`sticky top-0 z-20 flex flex-col gap-2.5`) junto con `.alon-zone-toolbar` (`sticky top-0 z-30`), manteniendo el contenedor raíz en `pb-10` y el scroll vertical confinado a `.alon-grid-scroll` (`max-h-[calc(100vh-340px)]`) debajo de `thead sticky` para que `<main>` detenga su recorrido exactamente al anclar la Zona 3 en el tope. |
| **Submenús/Modales de carga largos que requieren scroll vertical o confunden el paso actual** | Apilamiento monolítico vertical en 1 columna sin jerarquía cromática y con botones auxiliares que secuestran la tecla `Tab` | **Chroma-Chunking Bicolumna + Presupuesto de Viewport Modal (`.alon-modal-card`):** Estructurar todo modal de carga en 2 columnas de alta densidad (`max-w-5xl`, `max-h-[90vh]`), subdividir los pasos lógicos en tarjetas numeradas con borde de color semántico (`.alon-chunk-amber`, `-rose`, `-indigo`, `-emerald`, `-purple`, `-sky`), anclar siempre `.alon-modal-footer` al pie y asignar `tabIndex={-1}` a píldoras/botones accesorios para garantizar un recorrido 100% fluido con la tecla `Tab`. |

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
