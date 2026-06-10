# 🔌 Arquitectura del Servidor MCP Local

El servidor MCP (Model Context Protocol) local actúa como un traductor y canal seguro entre el agente de IA (Antigravity) y tus herramientas locales y en la nube. 

## 1. Diseño de Arquitectura

El servidor corre localmente como un proceso de Node.js y se comunica mediante **Standard Input/Output (stdio)** con el host MCP.

```mermaid
graph TD
    IA[Agente de IA (Host MCP)] <-->|Stdio JSON-RPC| MCP[Servidor MCP Local Node.js]
    MCP <-->|Lectura .env local| Env[(Archivo .env & Service Account)]
    MCP <-->|REST API + API Key| n8n[Local n8n Instance (Port 5678)]
    MCP <-->|Octokit REST + Token| GitHub[GitHub API]
    MCP <-->|Google APIs + Service Account| Google[Google Sheets API]
```

## 2. Herramientas Expuestas (*Tools*)

El servidor expone las siguientes herramientas base que la IA puede invocar de forma automática y transparente:

### 1. `n8n_list_workflows`
* **Descripción:** Lista los flujos de trabajo (activos e inactivos) de tu instancia local de n8n.
* **Propósito:** Validar que el servidor n8n está encendido y que la API Key inyectada tiene permisos operativos.

### 2. `google_sheets_read_headers`
* **Descripción:** Lee la primera fila (los encabezados) de una planilla de Google Sheets.
* **Argumentos:**
  - `spreadsheetId` *(requerido)*: ID de la hoja de cálculo.
  - `range` *(opcional)*: Rango a consultar (por defecto `Sheet1!A1:Z1`).
* **Propósito:** Validar que la Service Account local tiene accesos de lectura a la planilla maestra del proyecto.

### 3. `github_get_repo`
* **Descripción:** Recupera la información pública/privada de un repositorio de GitHub.
* **Argumentos:**
  - `owner` *(requerido)*: Usuario u organización dueña del repositorio.
  - `repo` *(requerido)*: Nombre del repositorio.
* **Propósito:** Confirmar que el token de acceso personal de GitHub está configurado correctamente y es válido.

## 3. Configuración y Consumo de Credenciales

El servidor MCP lee las variables de entorno desde el archivo `.env` en la raíz del proyecto. Resuelve de manera inteligente las rutas relativas (como `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`) mapeándolas al directorio raíz correcto.

### Ejemplo de Configuración en el Cliente (Host MCP)
Para integrar este servidor en tu entorno de desarrollo, debés añadir la configuración del servidor en el archivo de configuración del cliente (por ejemplo, `mcp.json` o `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "local-mcp-server": {
      "command": "node",
      "args": ["c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/mcp-server/index.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

*Nota: Asegúrate de que las dependencias de Node estén instaladas (`npm install`) en `mcp-server/` antes de encender el cliente.*
