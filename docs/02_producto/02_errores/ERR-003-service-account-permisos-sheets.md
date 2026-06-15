---
id: ERR-003
tipo: error
fase: [1]
estado: borrador
fecha: 2026-06-14
---
# Google Sheets API: "The caller does not have permission"

## Qué pasó
Al intentar conectar el servidor MCP con una planilla de Google Sheets usando las credenciales de la Service Account correctamente configuradas, la API de Google rechazó la conexión con el error: `Test failed: The caller does not have permission`.

## Tiempo perdido
~15 minutos (diagnóstico rápido, pero a un usuario sin contexto podría llevarle horas).

## Por qué falló
Una Service Account en Google Cloud funciona como un "robot" con una cuenta de correo electrónico propia (ej. `anigravity-mcp-google-cloud@appaloncar...`). Aunque el robot tenga habilitada la API de Google Sheets en GCP, **no tiene acceso a las planillas privadas de tu cuenta de Gmail** a menos que se las compartas explícitamente.

## Solución validada
1. Extraer el `client_email` del archivo `service-account.json`.
2. Abrir la planilla de Google Sheets objetivo en el navegador.
3. Hacer clic en "Compartir".
4. Agregar el correo del robot y darle permisos de "Lector" (o "Editor" si el flujo requiere escribir).
5. Tras esto, la conexión MCP es instantánea y exitosa.

## Cómo detectarlo rápido
Cualquier error `403 Forbidden` o mensaje `The caller does not have permission` al probar `read_sheet_schema`, asumiendo que el archivo JSON de credenciales está en la ruta correcta.
