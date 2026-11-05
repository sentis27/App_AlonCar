---
name: control-calidad-entrega
description: Control de calidad severo y obligatorio antes de declarar terminada cualquier tarea que modifique código, datos, configuración o documentación del proyecto. Garantiza que lo entregado coincida con la intención del usuario, con los estándares del proyecto, con la integridad de los datos y con todo lo pedido, respaldado por evidencia comprobable.
---

# Control de Calidad de Entrega (SKL-007)

## Problema general que resuelve

> **La distancia entre lo que se pidió y lo que se entregó, y la declaración de "terminado" sin evidencia.**

Esta skill no es un catálogo de errores conocidos. Es un sistema de control basado en
principios generales que se aplica igual a un botón, una consulta, una migración, un dato
o un módulo que todavía no existe. Los problemas nuevos **no** se resuelven agregando casos
a esta skill: se resuelven creando o corrigiendo un estándar en `docs/02_producto/estandares/`,
y esta skill obliga a usarlo como criterio de aceptación (P4).

---

## 0. Cuándo se activa

- **Siempre**, antes de decir "listo", "terminado", "aplicado" o cualquier equivalente.
- **Siempre**, antes de hacer commit o push.
- **Al inicio** de toda tarea, para construir la lista de requisitos (P2).
- En turnos de solo análisis o planificación (sin cambios) aplican únicamente P1 y P2.

---

## 1. Los 10 principios

Cada principio vale por sí mismo. Los ejemplos que acompañan a cada uno **ilustran una
clase de problema, no marcan su límite** (ver P8).

### P1. La intención manda sobre lo literal
Antes de ejecutar, responder: **¿qué resultado de negocio quiere obtener el usuario?**
La implementación técnica sirve a ese resultado, nunca al revés.
- Preguntas obligatorias: *¿Qué cambia para el usuario cuando esto funcione? ¿Qué problema deja de tener?*
- Si la consigna literal y la intención chocan, se advierte antes de ejecutar.

### P2. Todo lo pedido se registra y se sigue hasta cerrarlo
Cada pedido se convierte en un **requisito con ID** (R1, R2…) y permanece en la lista hasta
cerrarse con evidencia.
- Nada sale de la lista en silencio. Estados válidos: `CUMPLIDO`, `PENDIENTE` (con motivo),
  `NO VERIFICADO` (con instrucción para comprobarlo) o `DESCARTADO POR EL USUARIO`.
- Los requisitos de turnos anteriores se arrastran explícitamente al turno siguiente.
- Una corrección del usuario ("eso no lo solucionaste") **reabre** el requisito original;
  no crea uno nuevo desconectado.

### P3. Se verifica el resultado, no la acción
Ejecutar un comando, un script o una edición **no prueba nada**. Solo cuenta el estado final observado.
- Después de cada cambio se relee el artefacto final (archivo, registro en base de datos,
  pantalla, salida) y se compara contra el requisito.
- "Compila", "no dio error" o "el script terminó" son condiciones necesarias, **nunca suficientes**.

### P4. Los estándares del proyecto son criterios de aceptación
Toda entrega se contrasta con los documentos de `docs/02_producto/estandares/` que
correspondan al arquetipo declarado en `GEMINI.md`.
- Si un estándar define algo (colores, orden, nombres, componentes, comportamiento),
  cumplirlo es parte del requisito **aunque el usuario no lo repita**.
- Si estándar y pedido se contradicen, se pregunta; no se elige unilateralmente.

### P5. Coherencia: mismo resultado, mismo nombre y mismo comportamiento
Si dos elementos producen el mismo resultado, deben **llamarse igual, verse igual y
comportarse igual**, en todos los módulos.
- El nombre lo define **el resultado final para el usuario**, no el mecanismo intermedio.
- Aplica a botones, etiquetas, mensajes, modales, atajos, estados y colores.
- Antes de nombrar algo nuevo, se busca si ya existe un elemento con el mismo resultado.

### P6. Lo que funcionaba sigue funcionando
Toda modificación se evalúa también por lo que pudo **romper alrededor**: otros módulos que
usan el mismo componente, otras vistas que leen el mismo dato, atajos, filtros, exportaciones.
- Si se toca un componente o una función compartida, se identifican todos sus usos y se
  verifica su impacto.

### P7. Honestidad del estado
- Nunca se informa como hecho algo no comprobado.
- Lo parcial se informa **primero**, no al final.
- Lo que no pudo verificarse (por ejemplo, algo visual sin acceso a la pantalla) se declara
  `NO VERIFICADO`, indicando cómo comprobarlo.

### P8. Los ejemplos son clases, no listas cerradas
Todo ejemplo (del usuario, de un estándar o de esta skill) representa una **categoría de problema**.
1. Extraer el principio que lo explica: *"¿de qué clase de error es caso este ejemplo?"*
2. Buscar **todos los demás casos** de esa clase en el ámbito afectado, no solo el mencionado.
3. Ante una consigna nueva, preguntar: *"¿encaja en una clase ya conocida?"* Si encaja, aplicar la misma regla.

> Una corrección sobre un caso es una corrección sobre toda su clase.

### P9. Integridad y calidad de los datos
Los datos del negocio son el activo principal; ninguna entrega puede degradarlos.
- **Validación en origen y en destino:** las reglas (obligatoriedad, formato, rangos,
  normalización como mayúsculas o recorte de espacios) se aplican en la interfaz **y** se
  respaldan en la base de datos (restricciones, tipos, claves foráneas) cuando corresponda.
- **Unicidad y consistencia:** sin duplicados lógicos, sin registros huérfanos, sin valores
  equivalentes escritos de formas distintas.
- **Integridad referencial:** renombrar o eliminar un valor maestro exige propagar o reasignar
  todos sus usos; nunca dejar referencias rotas.
- **Operaciones destructivas o masivas:** antes de ejecutar, medir el alcance (cuántos registros
  afecta), pedir confirmación explícita y asegurar reversibilidad (respaldo, transacción o
  registro de auditoría).
- **Trazabilidad:** los cambios relevantes quedan auditados (quién, cuándo, qué valor anterior).
- **Seguridad:** respetar permisos y RLS; nunca exponer secretos ni claves en el código o el repositorio.
- **Migraciones:** todo cambio de esquema queda versionado en `supabase/migrations/`.
- **Verificación:** consultar el estado real de los datos antes y después del cambio (P3).

### P10. Rendimiento y escalabilidad del sistema
La solución debe seguir siendo rápida cuando los datos crezcan 10 veces.
- **Consultas:** traer solo las columnas y filas necesarias; filtrar y paginar en el servidor
  cuando el volumen lo justifique; evitar consultas repetidas dentro de bucles (N+1); contar
  con índices sobre los campos de filtro y relación más usados.
- **Interfaz:** evitar recálculos y renders innecesarios (memoización de cálculos pesados);
  las grillas grandes no deben bloquear la pantalla.
- **Escalabilidad:** no introducir soluciones que solo funcionen con el volumen actual
  (listas completas en memoria sin límite, cargas totales en cada interacción).
- **Mantenibilidad:** reutilizar componentes canónicos en lugar de duplicar lógica; la
  duplicación es deuda que multiplica errores.
- Si una decisión sacrifica rendimiento a cambio de simplicidad, se declara en el reporte.

---

## 2. Procedimiento de la compuerta (en cada entrega)

| Paso | Qué se hace | Principios |
| :--- | :--- | :--- |
| **G1. Lista de requisitos** | Armar o actualizar R1…Rn: pedidos del turno, arrastrados de turnos anteriores y exigencias de los estándares. Cada uno con un criterio de aceptación comprobable. | P1, P2, P4 |
| **G2. Barrido de clase** | Por cada requisito, identificar su clase y buscar otros casos de la misma clase en el ámbito afectado. | P5, P8 |
| **G3. Verificación de resultado** | Releer el estado final real de cada requisito y compararlo con su criterio. Priorizar evidencia automática (búsqueda en código, script de aserción, consulta a la base, build); la revisión manual es complemento. | P3 |
| **G4. Verificación de datos** | Si hubo cambios de datos o esquema: alcance medido, confirmación obtenida, estado antes/después consultado, integridad referencial intacta. | P9 |
| **G5. Verificación de entorno** | Build limpio, consola sin errores nuevos, usos de componentes compartidos revisados, sin consultas o renders que no escalen. | P6, P10 |
| **G6. Parar la línea** | Si un solo requisito no pasa: **no se entrega**. Se corrige y se vuelve a G3. Si no puede corregirse, se informa como `PENDIENTE` con su causa. | P7 |
| **G7. Reporte con evidencia** | Entregar el reporte de la sección 3. | P2, P7 |

---

## 3. Formato obligatorio del reporte de entrega

Se mantiene el estilo de reporte habitual (resumen claro de lo realizado, con enlaces a
archivos y evidencia), y se le agregan obligatoriamente estos bloques:

```markdown
### Control de calidad — Entrega

**Estado general:** CUMPLIDO | PARCIAL | BLOQUEADO

| ID | Requisito (intención) | Estado | Evidencia comprobable |
|----|-----------------------|--------|-----------------------|
| R1 | ... | CUMPLIDO / PENDIENTE / NO VERIFICADO | archivo:línea, salida de comando, consulta |

**Barrido de clase:** casos adicionales encontrados y corregidos: ...
**Impacto en otros módulos:** ...
**Pendientes y su motivo:** ...
```

---

## 4. Fuera del alcance de esta skill

- **Planificación y división de lotes de tareas en etapas** → skill separada (`planificacion-por-etapas`).
- **Reglas visuales o de negocio puntuales** → viven en `docs/02_producto/estandares/0X_*.md`.
  Esta skill obliga a usarlas como criterio (P4) pero no las repite.
- **Eficiencia del propio agente (consumo de tokens, cantidad de pasos)** → no es un criterio
  de calidad del producto y no puede justificar omitir verificaciones.
