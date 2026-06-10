# 🗺️ Mapa del Proyecto: Índice de Documentación y Contexto

> **Instrucción para el Agente (IA):**
> Este archivo es el índice central del proyecto. Antes de procesar solicitudes complejas, revisar el estado de conexiones o buscar reglas de diseño, utilizá este mapa para localizar el archivo exacto que contiene la información que necesitás. NO leas archivos completos si no están listados aquí o si no son estrictamente necesarios para la tarea actual.

## 1. Conexiones y Seguridad (Fase 1)
En esta sección se documenta cómo interactúan Antigravity, el servidor MCP, n8n y Google Workspace.
* **1.3.1 - Creación de Conexiones y Variables Locales:** `docs/01_conexiones/1.3.1_crear_conexiones.md`
  *(Contiene: Estructura del .env, uso de Service Accounts y protección de credenciales).*
* **Arquitectura del Servidor MCP:** [arquitectura_mcp.md](file:///c:/Users/senti/.gemini/antigravity/scratch/App_AlonCar/docs/01_conexiones/arquitectura_mcp.md)
  *(Contiene: Métodos expuestos para n8n y Google Sheets).*

## 2. Automatización y n8n
* **Reglas de Diseño y Estructura:** Las reglas de diseño para inyectar flujos no están locales, el agente debe usar la herramienta MCP de GitHub para leerlas desde los repositorios de referencia.

## 3. Producto Digital (Bitácora)
Esta sección contiene la redacción comercial y educativa para el infoproducto. El agente que programa la app **NO** necesita leer estos archivos a menos que el usuario pida explícitamente redactar un nuevo capítulo.
* **Registro Paso a Paso:** `docs/02_bitacora_producto/registro_paso_a_paso.md`

---
*Nota de mantenimiento: Cada vez que se cierre una tarea importante, el agente o el usuario deben agregar el enlace al nuevo archivo en este mapa.*