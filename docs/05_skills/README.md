# Sistema de Skills de Agentes IA

Esta carpeta almacena las "Skills" (Habilidades) del Agente IA (Antigravity). En nuestro paradigma, una Skill no es solo un bloque de código, es un ecosistema completo que le enseña al agente cómo pensar y actuar ante un problema.

## ¿Qué compone una Skill?
Cada Skill en este repositorio debe tener 3 componentes definidos:
1. **El Trigger (Disparador):** Qué frase o evento hace que el agente active esta habilidad.
2. **Las Herramientas (Tools):** Qué métodos del Servidor MCP necesita usar (ej. `read_sheet_schema`).
3. **El Formato de Salida (Output):** La plantilla estandarizada que el agente debe rellenar y guardar, garantizando que el trabajo humano sea consistente.

## Cómo Crear una Nueva Skill
1. Crea un nuevo archivo Markdown en este directorio (ej. `02_nueva_habilidad.md`).
2. Sigue la estructura base: define el Nombre, el Propósito, las Tools necesarias, y el Procedimiento paso a paso para el LLM.
3. Actualiza el `INDICE_SKILLS.md` agregando la nueva habilidad.
4. Asegúrate de que las herramientas MCP mencionadas estén realmente programadas en `mcp-server/index.js`.
