# Sistema de Revisión y Auditoría de Planillas

## 1. Objetivo
Separar los datos reales de carga (horas, materiales, terceros) de los comentarios o dudas generados durante el proceso de auditoría. Implementar un flujo de revisión basado en "Tickets" que notifique al operario de los errores sin alterar las descripciones originales de los trabajos, manteniendo un historial claro y auditable de las correcciones.

## 2. Roles y Permisos

*   **Operario (Data Entry):** 
    *   Carga datos iniciales.
    *   Edita datos propios en respuesta a tickets de revisión.
    *   **No puede eliminar filas** (salvo autorización expresa). Si necesita eliminar, debe solicitarlo vía ticket.
*   **Supervisor (Revisor/Admin):**
    *   Audita planillas.
    *   Crea tickets de revisión (alertas) para los operarios.
    *   Edita datos *in-situ* sin necesidad de crear ticket.
    *   Puede **eliminar filas**.
    *   Puede **desdoblar/dividir filas**.

## 3. Flujo de Trabajo (Ciclo de Vida de Revisión)

### Fase A: Auditoría (Supervisor)
1. El supervisor revisa las planillas de datos.
2. Si encuentra un error, tiene dos opciones:
    *   **Edición In-situ:** Corrige el dato directamente. El cambio queda registrado en el historial (Log).
    *   **Creación de Ticket:** Selecciona la fila (ícono 💬) y escribe su duda (Ej: *"La suma del día da 15 horas, verificar"*). La fila cambia su estado a `Observado`.

### Fase B: Corrección (Operario)
1. El operario recibe una alerta global 🔔.
2. Al acceder a la alerta, el sistema filtra la vista de la planilla mostrando **únicamente** las filas en estado `Observado`.
3. El operario lee el ticket, identifica el error y corrige el dato en la misma interfaz.
4. Responde al ticket (Ej: *"Corregido, fue error de tipeo"*) y envía la respuesta. 
5. El estado de la fila cambia a `Corregido_Pendiente_Aprobación`. *(El operario no puede cerrar el ticket).*

### Fase C: Cierre (Supervisor)
1. El supervisor es notificado de las respuestas.
2. Visualiza rápidamente el `[Valor Viejo] -> [Valor Nuevo]` y lee la respuesta.
3. Si está correcto, aprueba el cambio. El ticket se cierra y la fila vuelve a estado `Aprobado`.
4. Si es incorrecto, responde nuevamente y el ciclo vuelve a la Fase B.

## 4. Reglas de Negocio Clave

*   **Mecanismo de Bloqueo (Row Locking):** Para evitar colisiones (race conditions), cuando el Supervisor interactúa con una fila (✏️ o 💬), esta se bloquea en "Solo Lectura" para el Operario. Cuando el Supervisor envía el ticket, el bloqueo se invierte: el Operario tiene control para editar y el Supervisor no puede alterar esa fila hasta que el Operario responda.
*   **Aprobación Masiva (Bulk Approval):** En la Fase C, el Supervisor dispone de casillas de selección (checkboxes) para marcar múltiples filas corregidas y un botón de "Aprobar Seleccionadas", optimizando el tiempo y evitando la fatiga de clics.
*   **Flujo de Eliminación de Filas:** Si el Operario detecta que una fila no corresponde, responde al ticket solicitando su eliminación. El Supervisor lee la solicitud y ejecuta la eliminación. Toda eliminación es un **Soft-Delete** (borrado lógico), manteniendo el registro oculto en la base de datos junto con su ticket asociado para futuras auditorías.
*   **Desdoblamiento de Filas (Split):** El Supervisor puede duplicar una fila existente para redistribuir montos u horas (Ej: convertir una fila de 10hs en dos filas de 5hs asignadas a distintas órdenes de trabajo). El sistema vincula la fila nueva a la original en el historial de auditoría.

## 5. Modelo de Datos Conceptual

Para soportar esta arquitectura, se requiere que la base de datos implemente:
1.  **Tabla de Datos Base:** Con un campo `estado_revision` (Aprobado, Observado, Corregido_Pendiente_Aprobación).
2.  **Tabla de Tickets/Hilos:** Vinculada al ID del registro original, almacenando los mensajes entre Supervisor y Operario.
3.  **Tabla de Log de Cambios (Auditoría):** Registra cada modificación (`valor_viejo`, `valor_nuevo`, `usuario`, `fecha`). Incluye una columna `id_origen_cambio` para relacionar el cambio directamente con un Ticket de Revisión si corresponde.
