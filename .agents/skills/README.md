# Manual de Skills de Agente — App_AlonCar

Las Skills son un estándar abierto para extender las capacidades del agente mediante carpetas con un archivo `SKILL.md` e instrucciones accionables.

## Convención de Idioma en App_AlonCar
- **Skills transversales y de negocio del proyecto (`SKL-001`, `SKL-003`, `SKL-004`, `SKL-006`..`SKL-017`):** Se redactan en **español técnico claro** para alinear terminología ERP naval con `GEMINI.md`, estándares y bitácora de producto.
- **Skills genéricas de terceros o tooling (`caveman`, `rtk`):** Pueden mantenerse en **inglés** original.

## Dónde viven las Skills
- `<workspace-root>/.agents/skills/<carpeta-o-division>/<skill>/SKILL.md` (específicas del proyecto; catálogo maestro en [SKILLS_REGISTRY.md](SKILLS_REGISTRY.md))
- `~/.gemini/antigravity/skills/` (globales del usuario, si aplica)

## Estructura mínima de una Skill
1. Crear la carpeta dentro de `.agents/skills/transversal/` o `.agents/skills/M{1..6}-*/`.
2. Agregar `SKILL.md` con frontmatter YAML (`name`, `code`, `description`) y reglas verificables.
3. Registrar la Skill en [SKILLS_REGISTRY.md](SKILLS_REGISTRY.md) e indexarla en [INDICE_METADATOS.md](../../INDICE_METADATOS.md).

## Patrón de Carga Progresiva
1. **Descubrimiento:** El agente ve la lista de Skills o consulta el Router `SKL-016` en `GEMINI.md`.
2. **Activación:** Si la Skill aplica a la capa/archivo de la tarea, lee su `SKILL.md` completo.
3. **Ejecución:** Aplica las reglas de la Skill y valida la condición de cierre.
