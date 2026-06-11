---
id: CON-003
tipo: concepto
fase: [1]
estado: borrador
fecha: 2026-06-10
ultima_revision: 2026-06-10
---
# Arquitectura de la Bitácora de Producto

## En una línea
Sistema de gestión de conocimiento paralelo al código, que clasifica la experiencia viva del proyecto en inmutable y mutable.

## Desarrollo
Para que la bitácora escale y sirva como base de un producto comercial, se estructuró matemáticamente:
- **Modelo Inmutable (Fotografías del tiempo):** Errores (ERR-) y Decisiones (DEC-). Nunca se editan directamente; si cambian, se crea uno nuevo referenciando al original. Garantiza la trazabilidad del proceso.
- **Modelo Mutable (Evolución continua):** Conceptos (CON-) y Procesos (PRO-). Se editan in-place para reflejar siempre el entendimiento más refinado que tenemos hoy.

## Por qué importa en este proyecto
Es la base del valor comercial. App_AlonCar no solo entrega software, sino que empaqueta y documenta el puente exacto entre el "Google Sheet" y el ERP, para evitar que otros pierdan tiempo en los mismos errores.
