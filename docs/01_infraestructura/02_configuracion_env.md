# ⚙️ Configuración del Entorno (.env)

El sistema opera bajo un modelo de confianza cero (Zero Trust) en el código fuente. Ninguna credencial de desarrollo ni claves de acceso se escriben directamente en el código base.

## 1. Estructura Obligatoria del Archivo `.env`

El archivo `.env` debe ubicarse en la raíz del proyecto. Su estructura obligatoria es la siguiente:

```env
# CONFIGURACIÓN GENERAL DEL PROYECTO
ENV=development

# LOCAL n8n CONFIGURATION
N8N_API_URL=http://localhost:5678/api/v1
N8N_API_KEY=TU_API_KEY_DE_N8N_AQUI

# GITHUB CONFIGURATION
GITHUB_TOKEN=TU_TOKEN_DE_GITHUB_PERSONAL_AQUI

# GOOGLE CREDENTIALS PATH
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

---

## 2. Protocolo de Validación y Conectividad

Para confirmar que la inyección de variables es segura y que el entorno de desarrollo local está operativo, ejecuta el siguiente checklist:

### A. Auditoría de Seguridad de Git
Ejecuta el siguiente comando en la consola:
```bash
git status
```
**Criterio de Aceptación:** Los archivos `.env` y `service-account.json` **no deben aparecer** en la sección de archivos no rastreados (*Untracked files*). Si aparecen, el escudo de Git no está funcionando; no realices ningún commit hasta corregir el archivo `.gitignore`.

### B. Prueba de Conectividad a n8n
Utiliza el comando o la herramienta MCP del agente de IA para solicitar una lista de flujos activos en `localhost:5678`.
**Criterio de Aceptación:** Respuesta HTTP 200 con el listado de flujos (puede ser un array vacío si no hay flujos activos, pero no debe dar error de conexión o credenciales).

### C. Prueba de Conectividad a Google Cloud API
Solicita al servidor MCP leer los encabezados de la planilla maestra de Google Sheets inyectada.
**Criterio de Aceptación:** Lectura exitosa de la primera fila (`A1:Z1`) del ID de la hoja provista.
