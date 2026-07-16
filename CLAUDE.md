# CLAUDE.md

Instrucciones para agentes de IA (Claude Code, Antigravity) trabajando en App_AlonCar.

## Regla de oro

- Prohibido crear o modificar archivos en disco de forma unilateral.
- Toda propuesta de archivo nuevo o cambio se muestra primero en el chat y espera aprobación explícita del usuario.

## Seguridad

- Nunca credenciales, tokens o API keys en texto plano en ningún archivo del repo.
- Usar placeholders (ej. `TU_API_KEY_AQUI`) en ejemplos y documentación.
- Ver `docs/01_infraestructura/03_seguridad_credenciales.md` para el detalle de la política.

## Protocolo de cierre de sesión

- Al final de cada sesión de trabajo: actualizar `workflows/_meta/INDEX.md` y `TAREAS_PENDIENTES.md` con lo que se hizo.
- No cerrar una sesión con cambios sin reflejar en esos dos archivos.

## Mantenimiento de índices

- Todo archivo nuevo (documentación o workflow) se registra como fila en `INDICE_CENTRAL.md`.

## Workflows n8n — reglas de este repo

- Leer siempre `workflows/_meta/INDEX.md` antes de cualquier tarea sobre workflows.
- Leer el `SDD.md` del workflow afectado antes de modificarlo o de proponer cambios sobre él.
- Estados válidos en `INDEX.md`: `activo` (producción, SDD completo) / `activo-sin-SDD` (producción, SDD pendiente — deuda técnica) / `desarrollo` (no productivo).
- Un workflow **no puede** pasar a `activo` sin que su `SDD.md` esté completo.
- Detalle completo de la convención: `workflows/_meta/PLANTILLA.md`.

## Commits

- Formato: `tipo: descripción corta`.
- Tipos válidos: `feat`, `fix`, `docs`, `refactor`.
- Un commit por tarea — no mezclar tareas no relacionadas en un mismo commit.
- Push solo con confirmación explícita del usuario en el chat.

## Rol del asistente en este entorno

- Sin conexión directa a n8n: no opera ni despliega workflows.
- Ayuda a desarrollar nuevos workflows como JSON listo para importar en n8n.
- Revisa que las propuestas no rompan lógica de negocio existente — lee el `SDD.md` correspondiente antes de proponer un cambio.
- Actúa como memoria del proyecto: toda decisión relevante queda documentada (SDD, INDEX, TAREAS_PENDIENTES).
- Diseña flujos robustos y escalables, con manejo de errores contemplado desde el inicio (no como agregado posterior).

## Estándares de desarrollo n8n

- Flujos organizados de izquierda a derecha, en bloques funcionales separados.
- Sticky Notes para delimitar bloques: Trigger, Normalización, Validación, Enrutamiento, Escritura externa, Log/Alertas, Salida.
- Nodos Code en JavaScript: KISS, DRY, responsabilidad única por nodo.
- Versionado de workflows por nombre: `NombreWorkflow_v2`, `_v3`, etc. — nunca sobreescribir una versión existente.
- Referencias entre nodos Code por nombre explícito (ej. `$('NodoX').first().json`) — nunca `$input.first()` a ciegas (se rompe silenciosamente si se inserta un nodo intermedio).
- Placeholders de catálogo en prompts: `<<NOMBRE>>` — nunca `{{}}` (colisiona con la sintaxis de expresiones nativas de n8n).

## Lo que nunca hace

- Modificar archivos sin proponer primero.
- Incluir credenciales o tokens en ningún archivo.
- Asumir que una propuesta no rompe nada sin revisar el `SDD.md` del workflow afectado.
- Marcar un workflow como `activo` sin que su SDD esté completo.

## Skills — lectura bajo demanda

- `.agents/skills/caveman/` — compresión de output, leer antes de iniciar sesión larga
- `.agents/skills/rtk/` — compresión de comandos Bash, leer si hay outputs largos de terminal
