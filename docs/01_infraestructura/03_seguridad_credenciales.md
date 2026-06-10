# 🔒 Seguridad y Gestión de Credenciales

Este documento detalla la política de seguridad y el flujo de protección de accesos implementados en el proyecto.

## 1. El Riesgo del Hardcoding (Por Qué Protegemos las Llaves)

Uno de los errores más severos en el desarrollo de software es escribir contraseñas, tokens de API o claves de acceso directamente dentro del código de la aplicación (*hardcoding*). 

Si estas credenciales se guardan en el historial del repositorio:
* Quedarán expuestas públicamente si el repositorio se sube a GitHub de manera pública o si hay una fuga de código.
* Permitirán a atacantes comprometer servicios externos vinculados (n8n, Google Sheets, GitHub) en cuestión de minutos.
* Dificultarán la migración entre diferentes entornos (desarrollo, pruebas, producción), ya que el código estaría atado a credenciales específicas.

Para solucionar esto, utilizamos la inyección local a través del archivo `.env` (excluido de Git) y las Service Accounts de Google Cloud.

---

## 2. Acceso a Google Workspace mediante Service Accounts

Para interactuar con la planilla maestra de Google Sheets sin exponer la cuenta personal del usuario ni requerir interacción manual (OAuth), utilizamos una **Cuenta de Servicio (Service Account)**.

### Analogía del Acceso Seguro
* Imagina que tu proyecto es un club exclusivo y Google Sheets es el archivo con la lista VIP de invitados.
* En lugar de darle la lista original y completa al portero (el agente de IA), creamos una Cuenta de Servicio. Esta cuenta es como un robot asistente que solo tiene la llave para entrar a una habitación específica del club.
* Cuando la IA necesita consultar la planilla, se lo solicita al robot (servidor MCP). El robot va a Google Sheets usando su archivo JSON de credenciales (`service-account.json`), lee la celda exacta y se la trae de vuelta al entorno local.
* En ningún momento el código expone tus datos personales de acceso a Internet ni viajan contraseñas en texto plano por la red.

---

## 3. Regla de Oro: Crear la Cerradura antes del Tesoro

Antes de escribir tu primer token sensible en el archivo `.env` o de descargar las credenciales de Google Cloud, el primer paso obligatorio es configurar tu archivo de exclusión:
1. Crea tu archivo `.gitignore` en la raíz del proyecto.
2. Agrega los nombres de los archivos sensibles:
   ```text
   .env
   service-account.json
   ```
3. Verifica que Git los reconozca como excluidos antes de realizar tu primer commit. Esto blinda la seguridad desde el segundo cero del desarrollo.
