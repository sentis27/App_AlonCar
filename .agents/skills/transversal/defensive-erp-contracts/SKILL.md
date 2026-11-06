---
name: defensive-erp-contracts
description: Diseño defensivo para operaciones críticas de negocio. Garantiza atomicidad entre múltiples escrituras, sanitización estricta de tipos, trazabilidad obligatoria y prohibición absoluta de errores silenciosos.
---

# Tolerancia Cero a Fallas Silenciosas e Integridad Transaccional (SKL-015)

## 1. Diagnóstico del Vicio del Agente (El Problema de Raíz)
Al programar la capa de persistencia y mutación de estados, el agente incurre en **4 vulnerabilidades críticas**:
1. **Sesgo del Camino Feliz (Happy-Path Bias):** Programa asumiendo que las operaciones de red siempre tienen éxito, dejando el estado visual desincronizado de la base de datos cuando ocurre un rechazo.
2. **Tragado Silencioso de Excepciones:** Captura errores únicamente para imprimirlos en la consola de desarrollo, ocultándole al operador que su trabajo no se guardó.
3. **Inconsistencia en Escrituras Encadenadas:** Cuando una acción de negocio requiere impactar dos o más estructuras relacionadas, las ejecuta secuencialmente sin control de fallo, permitiendo que la primera se guarde y la segunda falle, corrompiendo la integridad cruzada del sistema.
4. **Contaminación por Objetos Nativos:** Pasa referencias directas de funciones a manejadores de eventos de interfaz, provocando que el objeto del evento nativo del navegador se infiltre y se guarde como dato corrupto en la base de datos.

---

## 2. Mandatos Negativos Estrictos (Qué NUNCA volver a hacer)

- **NEVER** escribas un bloque de captura de errores que solo registre en consola sin actualizar el estado visual de error, revertir el estado optimista local y notificar de forma accionable al usuario.
- **NEVER** dejes una operación multi-entidad a mitad de camino; si el paso secundario falla, el sistema debe compensar/revertir el paso primario o bloquear la confirmación avisando exactamente qué sincronización quedó pendiente.
- **NEVER** pases funciones de guardado directamente como referencia desnuda en eventos de interfaz (`onBlur={fn}`); envuélvelas siempre en una función explícita sin argumentos accidentales (`onBlur={() => fn()}`).
- **NEVER** envíes un valor hacia la base de datos o al registro de auditoría sin pasar por una compuerta de validación que rechace objetos complejos, eventos nativos o tipos inválidos donde se esperan escalares.
- **NEVER** ejecutes una mutación de datos en un módulo transaccional sin disparar su correspondiente registro inmutable en el servicio central de trazabilidad y auditoría.
- **NEVER** permitas el envío concurrente o duplicado de una misma transacción mientras una petición previa sigue en vuelo.

---

## 3. Matriz de Problemas y Salidas Estructurales (Las Herramientas)

| Síntoma / Problema Detectado | Causa Raíz | Salida Estructural (Solución Universal) |
| :--- | :--- | :--- |
| **Aparición de `[object Object]` o datos corruptos en celdas** | Inyección accidental del evento del DOM como argumento de datos | **Compuerta de Sanitización Escalar:** Validar en la frontera del servicio que todo valor destinado a un campo escalar sea primitivo (`string`, `number`, `boolean`, `null`), abortando la escritura si detecta instancias de eventos u objetos. |
| **Desincronización entre tablas vinculadas tras un guardado** | Escrituras secuenciales sin manejo de fallo parcial | **Orquestación Atómica con Rollback:** Agrupar las mutaciones dependientes bajo una sola unidad lógica; verificar el resultado de cada eslabón y, ante cualquier error, restaurar el estado previo en memoria y alertar al usuario. |
| **El usuario cree que guardó pero el cambio se perdió** | Actualización optimista sin verificación de respuesta | **Máquina de 3 Estados Forzosos:** Toda mutación transita obligatoriamente por: `1. En vuelo (con bloqueo de reentrada)` → `2. Confirmado por el motor de datos` o `3. Rechazado con reversión visual y alerta explícita`. |
| **Cambios en datos sin historial de quién, cuándo ni qué cambió** | Persistencia desconectada del motor de auditoría | **Contrato Indivisible Negocio-Auditoría:** Toda función de alta, baja, modificación unitaria o modificación por lote invoca de forma obligatoria el servicio unificado de auditoría registrando valor anterior y valor nuevo sanitizados. |

---

## 4. Freno de Auditoría Pre-Código (Protocolo de Verificación)
1. **Simulación de Fallo Intermedio:** Si la red se corta o la base de datos rechaza la petición en medio de esta función, ¿queda alguna tabla a medias? ¿Se entera el usuario en pantalla? ¿Se restaura el valor anterior en la interfaz?
2. **Verificación en Caliente:** Ninguna operación de datos se da por válida con solo compilar; debe probarse su ejecución real comprobando que el error de retorno sea nulo y que los datos persistidos cumplan el contrato.
