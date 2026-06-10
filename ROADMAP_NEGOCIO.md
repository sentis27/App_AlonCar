# 🗺️ Roadmap de Negocio - App_AlonCar

Este documento describe la visión a largo plazo y la lógica de negocio planificada para el ERP Naval e Industrial. Estos módulos serán implementados a partir de la **Fase 2**, una vez completada y validada la infraestructura base de conexiones y almacenamiento.

---

## Módulos Planificados (Sistema Óseo)

### 1. Módulo de Activos y Clientes (Core Naval)
* **Entidades:** Razones Sociales (Propietarios) y Barcos (Activos).
* **Regla Core:** Las Órdenes de Trabajo (OTs) se aplican al Barco; la facturación y deuda se asocian a la Razón Social. El historial del activo es indivisible.

### 2. Módulo de Recursos (Mano de Obra y Proveedores)
* **Entidades:** Proveedores, Talleres Externos, Operarios Internos/Externos, Tarifario por categoría.
* **Regla Core:** Los operarios externos dependen obligatoriamente de un taller externo homologado.

### 3. Módulo de Operaciones y Control de Costos (El Motor)
* **Entidades:** Órdenes de Trabajo (OTs), Registro de Asistencia (Reloj Biométrico), Asignación de Personal (Imputación de Horas).
* **Regla Core:** Centraliza el "Triángulo del Costo" (Mano de obra, materiales y servicios de terceros). n8n concilia automáticamente las horas de presencia (Reloj) contra las horas facturables (Imputación) para mitigar errores humanos. Soporta carga en bloque por cuadrillas.

### 4. Módulo de Logística y Suministros
* **Entidades:** Catálogo de Materiales, Inventario (Stock Físico/Virtual), Órdenes de Compra, Consumos por OT.
* **Regla Core:** Cada salida de pañol resta stock automáticamente. Las compras directas a obra esquivan el stock físico e impactan directo en el costo vivo de la OT.

### 5. Módulo Comercial (Presupuestos y Cierre)
* **Entidades:** Presupuestos (Cotizaciones), Anexos de Factura (Liquidación final).
* **Regla Core:** Clonación inteligente de presupuestos hacia anexos. Clasificación estricta mediante switch de ítems: "Mano de Obra" (Exento) o "Materiales" (Gravado con IVA) para automatizar el cálculo del PDF final.

### 6. Módulo de Cierre, Auditoría y Archivo Histórico
* **Jerarquía:** [BARCO] ➔ [VISITAS / PROYECTOS] ➔ [ÓRDENES DE TRABAJO].
* **Regla Core:** Data Locking automático por n8n. Cuando un lote de OTs pasa a estado "Facturado", el sistema bloquea y rebota cualquier intento de carga posterior. Divide los tableros en "Costo Vivo" (Obra actual) y "Costo Histórico" (Auditoría por año) para barcos recurrentes.
