---
name: product-collector
description: >
  Captura, clasifica y registra experiencia de proyecto en docs/02_producto/.
  Usar cuando el usuario dice "guardá esto", "anotá esto", "registrá lo que pasó",
  o cuando session-audit detecta contenido clasificable al cierre de sesión.
  NUNCA escribe a disco sin aprobación explícita del usuario.
---

# Skill: product-collector

Esta skill tiene una sola responsabilidad: convertir experiencia viva de sesión
en entradas permanentes dentro de `docs/02_producto/`, siguiendo la arquitectura
establecida. No documenta código. No actualiza infraestructura. Solo captura
el camino recorrido.

---

## Cuándo activarse

### Trigger manual (durante cualquier sesión)
El usuario dice alguna de estas frases o equivalentes:
- "guardá esto"
- "anotá esto"
- "registrá lo que pasó"
- "esto va al producto"
- "quiero que quede documentado"

### Trigger automático (desde session-audit)
`session-audit` llama a esta skill en su Step 3 cuando detecta al menos uno
de estos en la sesión:
- Una decisión arquitectónica tomada y justificada
- Un error resuelto con solución validada
- Una comprensión nueva que no existía al inicio de la sesión
- Un proceso ejecutado paso a paso que funcionó

Si session-audit no detecta ninguno de los cuatro, no llama a esta skill.

---

## Qué capturar (criterio de valor)

Capturar si la entrada responde SÍ a alguna de estas preguntas:

1. ¿Alguien que replique este proyecto perdería tiempo sin saber esto?
   → Capturar como error o decisión.

2. ¿Elegimos un camino sobre otro y hay una razón documentable?
   → Capturar como decisión.

3. ¿Entendimos algo hoy que no entendíamos ayer?
   → Capturar como concepto.

4. ¿Ejecutamos un proceso que funcionó y podría repetirse?
   → Capturar como proceso.

NO capturar:
- Tareas completadas (eso va a TAREAS_PENDIENTES.md, lo maneja session-audit)
- Cambios de código sin aprendizaje asociado
- Decisiones triviales sin justificación
- Conversación de contexto sin contenido reutilizable

---

## Cómo clasificar

### Árbol de decisión

```
¿Qué pasó?
│
├── Elegimos X sobre Y, hay una razón
│   └── → 01_decisiones/   prefijo DEC-
│
├── Algo salió mal, lo resolvimos
│   └── → 02_errores/      prefijo ERR-
│
├── Entendimos algo conceptualmente
│   └── → 03_conceptos/    prefijo CON-
│
├── Ejecutamos un proceso paso a paso
│   └── → 04_procesos/     prefijo PRO-
│
└── No está claro todavía
    └── → 00_raw/           nombre: sesion_YYYY-MM-DD.md
```

### Regla de ambigüedad
Si el contenido podría ir en más de una carpeta, clasificar en la que responda
la pregunta más útil para un lector futuro. En caso de duda real, ir a 00_raw/
y marcar `estado: pendiente-clasificar` en el header.

### Regla de granularidad
Un archivo = un aprendizaje. Si en la sesión hubo tres errores distintos,
son tres archivos ERR- separados, no uno solo con tres secciones.
Excepción: si los errores son parte del mismo problema encadenado, pueden
ir juntos con secciones separadas dentro del mismo archivo.

---

## Cómo asignar el ID

**La fuente de verdad para el último ID es siempre el sistema de archivos,
no el README.** El README es consecuencia, no fuente.

Proceso obligatorio antes de asignar cualquier ID:

1. Ejecutar: `ls docs/02_producto/[carpeta-destino]/` para listar archivos reales.
2. Extraer los números de todos los archivos con el prefijo correspondiente.
   Ejemplo: DEC-001, DEC-002, DEC-005 → el último es 005.
3. El nuevo ID = último número encontrado + 1, con padding a 3 dígitos.
4. Si la carpeta no existe o está vacía, empezar en 001.
5. Si el listado falla (error de acceso, carpeta no creada), alertar al usuario
   antes de continuar. No asumir que el contador está en cero.

El ID resultante va en el nombre del archivo Y en el campo `id` del header YAML.
Nunca asignar un ID sin haber ejecutado el paso 1.

---

## Modelo de actualización (híbrido)

### Errores (ERR-): modelo INMUTABLE

Los errores nunca se editan. Son fotografías del momento en que ocurrieron.
Su valor comercial está en mostrar el recorrido real, incluyendo soluciones
que resultaron incompletas.

Si una solución validada en ERR-003 resultó ser incorrecta o incompleta:
1. Crear un nuevo archivo ERR-NNN con la corrección.
2. En el nuevo archivo, campo `corrige_a: ERR-003` en el header YAML.
3. En ERR-003, agregar al final una línea:
   `> Actualizado en: ERR-NNN (YYYY-MM-DD) — [descripción breve de la corrección]`
   Esto es la única modificación permitida en un ERR- existente.

Esto preserva la historia completa: el error original, la solución inicial,
y la evolución del entendimiento.

### Conceptos (CON-) y Procesos (PRO-): modelo MUTABLE

El conocimiento conceptual mejora. Editar directamente el archivo existente.

Al editar un CON- o PRO- existente:
1. Actualizar el campo `ultima_revision` en el header YAML con la fecha de hoy.
2. Actualizar el campo `estado` si corresponde.
3. No crear un archivo nuevo. No referenciar versiones anteriores.
4. El contenido del archivo siempre refleja el entendimiento más actualizado.

### Decisiones (DEC-): modelo INMUTABLE

Las decisiones tomadas en un momento dado no se reescriben. Si una decisión
fue revertida o superada, crear DEC-NNN con `revierte_a: DEC-003` en el header.

---

## Estados y transiciones

### Estados válidos

- `borrador`: entrada creada, no revisada en sesión posterior.
- `validado`: entrada confirmada como correcta y completa.
- `pendiente-clasificar`: usado solo en 00_raw/, contenido sin clasificar.
- `superado`: para DEC- que fueron revertidas (no borrar, marcar).

### Reglas de transición

**borrador → validado:**
Solo por acción explícita del usuario. Frases que disparan la transición:
- "esto está bien", "confirmado", "marcá como validado", "esto es correcto"
Nunca automáticamente. Nunca por el paso del tiempo.

**borrador (estado indefinido):**
Los borradores no transicionan solos. Un ERR- puede estar en borrador
durante meses. Eso es aceptable. No alertar por borradores antiguos
a menos que el usuario lo pida explícitamente.

**pendiente-clasificar → [cualquier tipo]:**
Cuando el usuario o session-audit procesa un raw y decide su destino.
El archivo raw se mueve a la carpeta correcta y se renombra con el prefijo.

---

## Campo `fase`: regla de default

Si el usuario no especifica fase al momento de capturar:

1. Leer el campo `Estado Actual del Proyecto > Fase` en INDICE_CENTRAL.md.
2. Usar ese valor como fase por defecto.
3. Si INDICE_CENTRAL.md no está accesible, usar la fase de la sesión activa
   según lo que el usuario mencionó durante la conversación.
4. Si ninguna de las dos fuentes está disponible, usar `[1]` como fallback
   y marcarlo en el borrador con una nota: "fase inferida por defecto".

Nunca dejar el campo `fase` vacío.

---

## Política de limpieza de 00_raw/

Al inicio de cada ejecución de esta skill (trigger manual o automático):

1. Listar todos los archivos en 00_raw/.
2. Para cada archivo, calcular antigüedad desde la fecha en el nombre del archivo
   (formato sesion_YYYY-MM-DD.md).
3. Si hay archivos con más de 14 días sin clasificar, mostrar al usuario:

```
⚠ RAW SIN CLASIFICAR:
- sesion_2026-05-20.md (22 días)
- sesion_2026-05-28.md (14 días)

¿Querés procesarlos ahora o diferir?
```

4. Si el usuario dice diferir o ignora, continuar con la tarea principal.
   No bloquear. No repetir la alerta en la misma sesión.
5. Si el usuario dice "procesarlos ahora", ejecutar la clasificación de esos
   archivos antes de la tarea principal, usando el mismo flujo de borrador.

---

## Formato de borrador para aprobación

Antes de escribir cualquier archivo, mostrar este bloque en el chat.
Si hay múltiples entradas, mostrarlas todas juntas numeradas antes de pedir aprobación.

```
══════════════════════════════════════════
  PRODUCT-COLLECTOR — BORRADOR PARA APROBACIÓN
══════════════════════════════════════════

[1] ARCHIVO: docs/02_producto/[carpeta]/[ID]-[slug].md
    TIPO:    [decision | error | concepto | proceso | raw]
    ACCIÓN:  [nuevo | actualización de CON-XXX]

[contenido completo del archivo, incluyendo header YAML]

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

[2] ARCHIVO: docs/02_producto/[carpeta]/[ID]-[slug].md
    ...

══════════════════════════════════════════
Opciones:
  OK       → escribe todos los archivos
  EDITAR N → modificar la entrada N antes de escribir
  DIFERIR  → guardar borradores en 00_raw/pendientes/ sin escribir definitivo
  DESCARTAR N → eliminar la entrada N del lote
══════════════════════════════════════════
```

### Comportamiento de DIFERIR

Cuando el usuario elige DIFERIR:
1. Crear un archivo en `00_raw/pendientes/` con nombre `pendiente_YYYY-MM-DD_[slug].md`.
2. El archivo contiene el borrador completo tal como fue generado.
3. El archivo tiene `estado: pendiente-aprobar` en el header.
4. En la próxima sesión, session-audit detecta archivos en 00_raw/pendientes/
   y los presenta al usuario para aprobación antes de cerrar.
5. No registrar en INDICE_METADATOS.md hasta aprobación final.

---

## Formato interno de cada archivo

### Header YAML (obligatorio, siempre primero)

Para archivos nuevos:
```yaml
---
id: DEC-001
tipo: decision
fase: [1]
estado: borrador
fecha: YYYY-MM-DD
---
```

Para actualizaciones de CON- o PRO-:
```yaml
---
id: CON-001
tipo: concepto
fase: [1]
estado: borrador
fecha: YYYY-MM-DD
ultima_revision: YYYY-MM-DD
---
```

Para correcciones de ERR- (archivo nuevo):
```yaml
---
id: ERR-007
tipo: error
fase: [1]
estado: borrador
fecha: YYYY-MM-DD
corrige_a: ERR-003
---
```

### Cuerpo según tipo

**Para decisiones (DEC-):**
```markdown
# [Título que describe la decisión tomada]

## Contexto
[Qué situación generó esta decisión. 2-4 oraciones máximo.]

## La duda
[Cuál era la alternativa o la pregunta sin responder.]

## La decisión
[Qué se eligió exactamente.]

## Por qué
[Justificación técnica, práctica, o de negocio.]

## Consecuencia
[Qué implica esta decisión hacia adelante.]
```

**Para errores (ERR-):**
```markdown
# [Título que describe el error, no la solución]

## Qué pasó
[Descripción del error. Qué se intentó, qué falló.]

## Tiempo perdido
[Estimación honesta: "~2 horas", "~30 minutos".]

## Por qué falló
[Causa raíz, no síntoma.]

## Solución validada
[Exactamente qué se hizo para resolverlo.]

## Cómo detectarlo rápido
[Síntomas que indican que alguien está en el mismo error.]
```

**Para conceptos (CON-):**
```markdown
# [Título del concepto]

## En una línea
[Definición en máximo 20 palabras.]

## Desarrollo
[Explicación completa. Sin límite de extensión.]

## Por qué importa en este proyecto
[Conexión específica con App_AlonCar.]
```

**Para procesos (PRO-):**
```markdown
# [Título del proceso]

## Cuándo usarlo
[Situación que dispara este proceso.]

## Pasos
[Numerados. Exactamente como se ejecutaron. Sin omitir pasos que parecen obvios.]

## Resultado esperado
[Cómo sabés que funcionó.]

## Errores comunes
[Qué puede salir mal en cada paso, si se sabe.]
```

**Para raw (00_raw/):**
```markdown
# Sesión YYYY-MM-DD

[Crónica libre. Sin estructura impuesta. Todo lo que pasó,
en el orden que pasó, con el nivel de detalle disponible.]
```

---

## Qué actualizar después de escribir

Después de que el usuario apruebe y se escriban los archivos:

1. **Actualizar README.md de docs/02_producto/:**
   Agregar una línea en la tabla del tipo correspondiente:
   `| ID | Título | Fecha | Estado |`
   También insertar una fila al FINAL de la tabla "Línea temporal" con la fecha actual.

2. **Notificar a session-audit:**
   Incluir en el resumen de cierre la lista de archivos creados o modificados,
   para que session-audit los registre en INDICE_METADATOS.md.
   No tocar INDICE_METADATOS.md directamente.

3. **No modificar ningún otro archivo del repositorio.**

---

## Reglas absolutas

- NUNCA escribir a disco sin aprobación explícita del usuario.
- NUNCA asignar un ID sin leer el sistema de archivos primero.
- NUNCA editar un ERR- o DEC- existente (excepto agregar la línea de referencia).
- NUNCA mezclar múltiples aprendizajes no relacionados en un solo archivo.
- NUNCA crear carpetas fuera de docs/02_producto/.
- NUNCA modificar archivos de otras secciones del repositorio.
- Si el contenido contiene credenciales o datos sensibles, redactar en términos
  genéricos y alertar al usuario antes de mostrar el borrador.
