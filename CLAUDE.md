---
version: 1.1
last_updated_by: antigravity
last_updated: 2026-11-03
---

# CLAUDE.md

Instrucciones para agentes de IA (Claude Code, Antigravity) trabajando en App_AlonCar.

## Inicio de sesión obligatorio

1. `git pull` antes de cualquier tarea
2. Verificar que la versión en el frontmatter coincide con la última en `main`
3. Si hay diferencia, frenar y resolver antes de continuar

*Esta regla aplica para Claude Code y Antigravity.*

## Regla de oro

- Prohibido crear o modificar archivos en disco de forma unilateral.
- Toda propuesta de archivo nuevo o cambio se muestra primero en el chat y espera aprobación explícita del usuario.

## Seguridad

- Nunca credenciales, tokens o API keys en texto plano en ningún archivo del repo.
- Usar placeholders (ej. `TU_API_KEY_AQUI`) en ejemplos y documentación.
- Ver `docs/01_infraestructura/03_seguridad_credenciales.md` para el detalle de la política.

## Protocolo de cierre de sesión y actualización de repositorios

- Al final de cada sesión de trabajo: actualizar `workflows/_meta/INDEX.md` y `TAREAS_PENDIENTES.md` con lo que se hizo.
- **Matriz de Responsabilidad de Datos (Documento Vivo):** Cada vez que el usuario pida actualizar repositorios o al cierre de sesión, se debe revisar la conversación y actualizar `docs/MATRIZ_RESPONSABILIDAD_DATOS.md` con las nuevas reglas, roles y responsables definidos (priorizando `trigger`, `persona responsable`, `name`, `module`, `field_key`, `responsible_role`). Asimismo, en cada sesión se deben recordar los datos y disparadores que van faltando definir.
- No cerrar una sesión con cambios sin reflejar en estos archivos.

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

## Estándares Mandatorios de Módulos (UI/UX) — PROTOCOLO OBLIGATORIO

- **Referencia Maestra Indiscutible:** La pantalla y código de `app/src/pages/Compras.jsx` y la guía `docs/02_producto/ESTANDARES_MODULOS_UI_UX.md` son el modelo obligatorio para cualquier módulo del ERP AlonCar.
- **Prohibición de Tablas HTML Huérfanas:** Queda estrictamente prohibido crear pantallas con `<table>` estándar o estilos aislados. Toda planilla debe instanciar e implementar obligatoriamente el hook `useSpreadsheetGrid` (`app/src/hooks/useSpreadsheetGrid.js`).
- **Arquitectura de 5 Zonas Cromáticas Centralizada (`index.css`):**
  1. `Zona 1 (.alon-zone-context)`: Borde cielo (`sky-400`), título con badge de versión, pestañas superiores compactas a la derecha y botón de acción principal.
  2. `Zona 2 (.alon-zone-kpis)`: Borde ámbar (`amber-400`), encabezado destacado `📊 RADAR DE KPIS Y ALERTAS OPERATIVAS • Clic en cualquier tarjeta para filtrar` y **tarjetas de KPI con colores únicos sin repetir**. Prohibido usar la palabra "Filtrar".
  3. `Zona 3 (.alon-zone-toolbar)`: Borde cian (`cyan-400`), buscador con `Ctrl+F` y limpieza instantánea con `Esc`, selects en cascada y botón `[↩ Deshacer (Ctrl+Z)]`.
  4. `Zona 4 (.alon-zone-grid)`: Borde superior esmeralda (`emerald-400`), cinta `.alon-grid-ribbon` con coordenadas GPS (`Navigation`), cálculos en vivo (Suma, Promedio, Recuento), botón de inserción de fila `[+ + Insertar Fila en #N]` y cabecera `.alon-grid-thead` con columna 1 apilada `[ ]/#` y columnas marcadas con `✎`.
  5. `Zona 5`: Barra flotante inferior de acciones masivas al tildar filas.
- **Regla de Edición Total:** Cada celda visible en la grilla debe ser editable mediante doble clic (o `Enter`/`F2`), con activación de `showPicker()` en fechas, datalists o selects según corresponda y tirador de arrastre celeste (*Fill Handle* `■`) para `Ctrl+D`.
- **Checklist de Entrega:** Antes de dar un módulo por finalizado, el agente debe auto-auditar visual y estructuralmente el módulo contra `Compras.jsx`, asegurando `Fit-to-Viewport` (cero scroll horizontal de ventana) y compilación limpia con `npm run build` y `npm run lint`.

## Agentes especializados

- `automation-governance-architect` — activa automáticamente ante modificaciones a workflows en producción, y cuando el usuario lo pide explícitamente. Aplica en Claude Code y Antigravity.
- `database-optimizer` — pendiente de instalación; invocar cuando arranque la migración Sheets→Supabase
- `graphify` — pendiente de instalación; invocar cuando empiece el desarrollo de la app en código real
