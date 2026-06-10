# Arquitectura del Servidor MCP Local

Este documento define la estructura, los métodos expuestos y el protocolo de comunicación del servidor MCP (Model Context Protocol) de App_AlonCar.

## 🎯 Propósito del Servidor MCP

El servidor MCP actúa como la capa de Lógica de Negocio y puente seguro entre el Agente IA (Antigravity), el Orquestador (n8n) y los datos externos (Google Sheets). 

Su función principal es encapsular reglas de negocio complejas y exponer "herramientas" (Tools) estandarizadas para que la IA o n8n puedan ejecutarlas de manera restringida y auditable, siguiendo nuestro modelo Zero Trust.

## ⚙️ Especificaciones Técnicas

- **Entorno:** Node.js local
- **Protocolo de Transporte:** `StdioServerTransport` (para integración directa con IDE) o HTTP/SSE (para n8n).
- **Ubicación del Código:** `mcp-server/index.js`
- **Gestión de Secretos:** Variables en `.env` inyectadas al entorno de Node.js en tiempo de ejecución.

## 🛠️ Herramientas (Tools) Expuestas

De acuerdo a la especificación de Fase 1, el servidor expone inicialmente los siguientes métodos Core para facilitar la transición a Fase 2:

### 1. `read_sheet_schema()`
- **Descripción:** Lee la estructura y el esquema de las planillas de Google Sheets actuales (Legacy).
- **Entrada (Inputs):** `spreadsheetId` (String), `sheetName` (String).
- **Lógica Interna:** 
  - Se conecta a Google Sheets usando la Service Account.
  - **Restricción de Seguridad:** Lee obligatoriamente solo los encabezados y un máximo de 50 filas de datos de muestra para inferir tipos de datos. No extrae la sábana completa de datos.
- **Salida (Output):** JSON estructurado con los nombres de las columnas y el tipo de dato inferido.

### 2. `write_n8n_workflow()`
- **Descripción:** Permite a la IA generar o modificar flujos en la instancia local de n8n.
- **Entrada (Inputs):** `workflowName` (String), `nodesConfig` (JSON), `stickyNotes` (Array of Strings).
- **Lógica Interna:**
  - Consume la API REST local de n8n (`localhost:5678/api/v1/workflows`).
  - Agrega notas adhesivas virtuales (Sticky Notes) generadas por la IA explicando la lógica de negocio de cada bloque para auditoría humana.
- **Salida (Output):** URL local del workflow creado y mensaje de éxito.

*(Nota: En Fase 2+, se agregarán métodos como `imputarHoras()`, `validarTarifa()`, `cerrarVisita()`, etc.)*

## 🔄 Flujos de Comunicación

### A. IDE (Antigravity) ➔ MCP ➔ Servicios Externos
1. Antigravity necesita entender una planilla.
2. Llama a la herramienta `read_sheet_schema` a través de la configuración global del IDE (archivo `mcp-settings.json`).
3. El servidor Node.js local ejecuta la lógica, consulta a Google, y devuelve el JSON con los encabezados.
4. El agente procesa la respuesta para continuar el diseño de la base de datos.

### B. n8n ➔ MCP (Próximamente)
1. Un operario ficha salida en el reloj biométrico.
2. El webhook de n8n captura el evento.
3. n8n hace una llamada (HTTP Request o nodo MCP) al servidor para validar la coherencia del horario.
4. El servidor MCP devuelve `{"valid": true, "costo": 1500}`.
5. n8n guarda en Supabase.

## 🔐 Seguridad Integrada

1. **Sin credenciales en el cliente:** El IDE o n8n solo envían parámetros de negocio. Las API Keys y el `service-account.json` viven únicamente en la carpeta del servidor.
2. **Rate Limiting / Payload Limiting:** El servidor fuerza límites físicos (ej. el límite de 50 filas en `read_sheet_schema`), protegiendo la API de Google de extracciones masivas accidentales por parte de la IA.
