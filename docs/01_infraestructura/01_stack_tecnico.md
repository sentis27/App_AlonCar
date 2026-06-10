# 🛠️ Stack Técnico y Metodología

Este documento define la base tecnológica del proyecto App_AlonCar y los pilares metodológicos de su desarrollo.

---

## 1. Metodología: Spec Driven Development (SDD)

El proyecto se construye bajo el paradigma de **Desarrollo Guiado por Especificaciones (Spec Driven Development)**. 
* La documentación técnica en formato Markdown (.md) dentro del directorio `docs/` actúa como la **"Constitución" y fuente de verdad absoluta** para el diseño, las reglas de negocio y los límites de operación del sistema.
* Antes de escribir código, se deben redactar y aprobar las especificaciones técnicas.
* Cualquier comportamiento del agente de IA o del código que contradiga las especificaciones documentadas se considerará un error crítico de implementación.

---

## 2. Arquitectura del Sistema (Modelo Híbrido)

El ERP opera bajo un flujo de datos distribuido y de bajo acoplamiento:

* **Interfaz Operativa de Entrada (Google Sheets):** Usada como sistema legado para la carga inicial de datos por parte del usuario final.
* **Orquestador y Aduana de Datos (n8n):** Instancia local que corre bajo Docker. Escucha webhooks, procesa lógica, transforma estructuras y actualiza la base de datos central.
* **Cerebro de Procesamiento (Servidor MCP Local):** Servidor integrado en Node.js que expone herramientas stdio estructuradas para que los agentes de IA puedan interactuar con las APIs de n8n, Google Workspace y GitHub sin comprometer secretos.
* **Base de Datos Central (Supabase / PostgreSQL):** Repositorio relacional central para almacenar la persistencia de datos (Activos, Recursos, Logística, etc.).
