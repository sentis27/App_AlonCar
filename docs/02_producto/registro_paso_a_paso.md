# Configuración de Accesos: El Escudo Invisible de tu Proyecto

## 1. El "Por Qué" de este paso (El error que te puede costar el proyecto)
Uno de los errores de novato más destructivos en la programación es el hardcoding: escribir tus contraseñas o tokens directamente dentro del código de tu aplicación. Si por accidente llegaras a subir ese archivo a un repositorio público de GitHub, o si un malware infectara tu PC, los atacantes tendrían acceso total a tus cuentas y datos.

Para solucionar esto con estándar corporativo, utilizamos la combinación perfecta: Google Sheets + Archivo `.env`. Sheets actúa como tu bóveda maestra en la nube, y el `.env` inyecta esas llaves únicamente en tu computadora local. Tu código nunca conoce las contraseñas, solo sabe cómo usarlas. Esto no solo blinda tu seguridad, sino que acelera tu desarrollo porque podés cambiar de entorno (de pruebas a producción) simplemente cambiando un archivo de texto.

---

## 2. La Guía Visual Mental: ¿Cómo lee la IA sin exponer tus datos?
Imaginá que tu proyecto es un club exclusivo y Google Sheets es el archivo con la lista VIP de invitados.
En lugar de darle la lista original y completa al portero (la IA de Antigravity), lo que hacemos es crear una "Service Account" (Cuenta de Servicio). Esta cuenta es como un robot asistente ciego que solo tiene la llave para entrar a una habitación específica.

Cuando la IA necesita un dato, se lo pide al robot. El robot va a Google Sheets, lee la línea exacta, y se la trae de vuelta al entorno local. En ningún momento la IA ni el código acceden a la planilla completa ni exponen tus datos de acceso a internet. La información fluye por un tubo encriptado directamente hacia el cerebro de tu proyecto.

---

## 3. Tip de Oro (Valor Premium)
Creá la cerradura antes de traer el tesoro.
Antes de escribir tu primer token en el archivo `.env` o de descargar tu archivo `.json` de Google, lo primero que debes crear es tu archivo `.gitignore` y escribir los nombres de esos archivos adentro. De esta manera, activás el escudo protector de Git desde el segundo cero. Si te olvidas de hacerlo y haces un guardado (commit), tus claves viajarán a la nube y tendrás que revocarlas y empezar de nuevo. La seguridad proactiva es la marca de un profesional.

---

## 4. Sesión Técnica: Arquitectura MCP, Modelado de Datos y Ecosistema de Skills
Durante la planificación del servidor MCP y la extracción de datos de Google Sheets, nos encontramos con varios dilemas arquitectónicos fundamentales. Así los detectamos y resolvimos:

### El Dilema del Servidor: Local vs Nube (VPS)
- **La Duda:** Si configuro el MCP en mi máquina local para poder programar fluidamente, mi máquina tendrá que estar encendida 24/7 para que las automatizaciones de negocio de n8n funcionen. ¿Deberíamos desarrollarlo directo en Hostinger?
- **La Solución (Capa de Transporte):** Diseñamos el código del servidor para que sea "agnóstico". Durante el desarrollo (Fases 1 y 2), el MCP corre en local usando `StdioServerTransport`, permitiendo que el IDE (Antigravity) se comunique nativamente con él. Para producción (Fase 3), usaremos el *mismo código exacto*, cambiando únicamente una línea para usar un transporte de red (HTTP/SSE) y alojarlo en el VPS.

### El Problema de las Planillas "Frontend"
- **La Duda:** En mis planillas de Google, la fila 1 no tiene los encabezados. La parte superior actúa como un panel de control con sumatorias y filtros rápidos. Los datos reales pueden empezar en la fila 5.
- **La Solución:** En lugar de codificar reglas rígidas ("lee siempre la fila 1"), dotamos al MCP de un algoritmo de autodescubrimiento heurístico: el código descarga un bloque de 100 filas y busca matemáticamente la fila con mayor densidad de datos contiguos para identificar el verdadero encabezado, ignorando la "basura" visual de arriba.

### La Barrera Oculta de Google: Apps Script
- **La Duda:** Me interesa que el MCP extraiga no solo los datos, sino las fórmulas embebidas y el código de Apps Script atado a la planilla.
- **La Solución:** Para las fórmulas, usamos la API nativa de Sheets con el parámetro `valueRenderOption="FORMULA"`. Sin embargo, los scripts están bloqueados por la seguridad de Google. Identificamos que es un requisito técnico innegociable crear una tarea bloqueadora en el proyecto: habilitar la "Google Apps Script API" en Google Cloud para otorgar permisos avanzados a la Service Account.

### ¿Qué es exactamente una "Skill" en IA?
- **La Duda:** Creamos una plantilla Markdown muy detallada para estandarizar cómo documentar las planillas viejas. ¿Esto se considera una "Skill" o es solo un documento pasivo?
- **La Solución:** Redefinimos el concepto. En el desarrollo de agentes autónomos, una Skill es una trinidad: La Herramienta técnica (Código Node.js) + El Formato de Salida (La Plantilla Markdown) + La Directiva Cognitiva (Las reglas del prompt). La plantilla combinada con el motor del agente constituye una Skill sumamente avanzada.

### Lección Arquitectónica: No luches contra el ecosistema nativo
- **El Error:** Intentamos guardar las nuevas Skills en una carpeta arbitraria que creamos a mano llamada `docs/05_skills/`. 
- **El Problema:** Esto convertía las skills en simples archivos de texto "muertos". El agente tenía que ir a buscarlas manualmente leyendo el directorio, desaprovechando el motor nativo del IDE.
- **La Corrección:** Tras leer el manual oficial, integramos el estándar del editor, moviendo todo a la carpeta nativa `.agents/skills/`. Al hacerlo, el propio IDE ahora inyecta automáticamente estas habilidades en el "cerebro" del agente al inicio de cada conversación sin necesidad de buscar (Auto-descubrimiento).

### El Escudo de la Memoria: Reglas de Anteproyecto
- **La Duda:** No quiero que el agente IA escriba código directamente en el disco duro sin que yo lo valide antes, porque un malentendido del contexto puede ser destructivo para el repositorio.
- **La Solución Implementada:** Inyectamos en la constitución del agente (`GUIA_ANTIGRAVITY.md`) la "Regla de Anteproyecto". El agente ahora tiene estrictamente prohibido modificar archivos reales sin antes presentar un borrador en el chat y recibir un "OK" explícito del usuario. Esta barrera humana es vital para elevar el desarrollo con IA de un nivel "experimental" a un "estándar corporativo seguro".
