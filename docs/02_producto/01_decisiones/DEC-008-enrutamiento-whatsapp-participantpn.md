---
id: DEC-008
tipo: decision
fase: [1]
estado: borrador
fecha: 2026-07-19
---

# Enrutamiento de respuestas y alertas por WhatsApp al teléfono emisor (participantPn)

## Contexto
Los reportes de horas ingresan al sistema principalmente a través de grupos de WhatsApp del astillero utilizando Evolution API (`Webhook1`). En un grupo de WhatsApp (`@g.us`), el campo `remoteJid` identifica al grupo en su totalidad, mientras que el campo `participantPn` identifica el número telefónico individual del usuario físico que envió el mensaje.

## La duda
¿Las confirmaciones de carga y las alertas de revisión (`E9 - ResponderUsuario WA` y `E1b - Solicitar Fecha`) deben enviarse de vuelta al grupo general de WhatsApp o directamente al teléfono de la persona que emitió el reporte?

## La decisión
Configurar el parámetro de destino (`Número do Destinatário` / `remoteJid`) en todos los nodos de respuesta y alerta de WhatsApp (`E9` y `E1b`) utilizando dinámicamente la expresión que apunta al teléfono del emisor individual:
`={{ $('Webhook1').item.json.body.data.key.participantPn }}`

## Por qué
Si el bot responde al grupo general de WhatsApp, genera contaminación visual, expone errores de tipeo individuales frente a todo el equipo y molesta a operarios no involucrados. Al dirigir el diagnóstico (`E9a`) y las solicitudes de corrección de fecha (`E1b`) directamente al chat privado (`participantPn`) del usuario que envió el mensaje, logramos un feedback loop privado, empático y preciso.

## Consecuencia
Toda comunicación saliente hacia WhatsApp desde n8n extrae obligatoriamente la variable `participantPn` del payload inicial de `Webhook1`.
