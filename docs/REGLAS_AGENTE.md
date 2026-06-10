# 🤖 Reglas de Comportamiento y Coherencia para el Agente (IA)

> **IMPORTANTE PARA EL AGENTE:**
> Este documento establece las normas obligatorias que debes seguir al interactuar con el código, estructura y documentación de este proyecto. Tu objetivo es mantener el repositorio limpio, coherente y libre de desorganización.

---

## 1. Reglas de Contenido y Limpieza de Documentación
* **Cero Formato Borrador:** Nunca guardes contenido con textos como `"BLOQUE 1"`, `"BLOQUE 2"`, `"Para guardar en: ..."` u otras instrucciones del portapapeles/correo del usuario. Procesa y limpia todo texto antes de escribirlo.
* **Separación de Responsabilidades:**
  - El **código técnico** y las guías operativas de infraestructura van en `docs/01_infraestructura/`.
  - Los **textos de negocio futuros** van en `ROADMAP_NEGOCIO.md` o en borradores en `docs/03_negocio/`.
  - El **contenido comercial/educativo** (bitácoras, guías mentales) va en `docs/02_producto/`.
* **Honestidad en el README:** El `README.md` de la raíz debe describir **únicamente el estado actual operativo** del proyecto. No debes prometer o describir módulos no implementados como si estuvieran listos; para eso está el backlog (`TAREAS_PENDIENTES.md`) y el roadmap (`ROADMAP_NEGOCIO.md`).

## 2. Reglas de Estructura e Índice Central
* **No Enlaces Rotos o Promesas Vacías:** El archivo `docs/INDICE_CENTRAL.md` debe contener únicamente archivos que **existan y sean funcionales** en el momento actual del repositorio. No uses placeholders o marcas de `"Próximamente"` en el mapa; ponlos en `TAREAS_PENDIENTES.md`.
* **Sincronización de Ignorados:** Asegúrate de mantener el archivo `.antigravityignore` actualizado. Cualquier carpeta no técnica (como `docs/02_producto/`) debe ignorarse para evitar que se sature tu ventana de contexto con contenido comercial o educativo irrelevante para programar.

## 3. Proactividad del Agente (Control de Calidad)
* **Auditoría de Entradas:** Si el usuario te pide crear un archivo copiando y pegando un fragmento crudo, **no lo hagas literalmente**. Avísale que vas a limpiarlo y estructurarlo adecuadamente primero.
* **Alertas de Desorden:** Si detectas que un archivo del repositorio contradice a otro (por ejemplo, el README describe cosas que no existen, o el `.gitignore` está mal configurado), detén el flujo y adviértele al usuario proponiéndole una refactorización (como la que originó este documento).
