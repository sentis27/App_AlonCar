# App_AlonCar
# ERP NAVAL E INDUSTRIAL - DOCUMENTO MAESTRO

## METODOLOGÍA DE DESARROLLO
Este proyecto se construye bajo la metodología Spec Driven Development (SDD). La documentación técnica en formato Markdown (.md) dentro de este repositorio actúa como la "Constitución" y fuente de verdad absoluta para el diseño, las reglas de negocio y el comportamiento de los agentes de Inteligencia Artificial.

## ARQUITECTURA DEL SISTEMA (HÍBRIDA)
* **Interfaz Operativa de Entrada:** Google Sheets (Legado/Transición).
* **Orquestador y Aduana de Datos:** n8n (Instancia Local/Docker) conectado vía Webhooks y API.
* **Cerebro de Procesamiento:** Servidor MCP (Model Context Protocol) local integrado en el IDE.
* **Base de Datos Central:** Supabase / PostgreSQL Relacional.

---

## INVENTARIO DE MÓDULOS (SISTEMA ÓSEO)

### 1. Módulo de Activos y Clientes (Core Naval)
* **Entidades:** Razones Sociales (Propietarios) y Barcos (Activos).
* **Regla Core:** Las Órdenes de Trabajo se aplican al Barco; la facturación y deuda se asocian a la Razón Social. El historial del activo es indivisible.

### 2. Módulo de Recursos (Mano de Obra y Proveedores)
* **Entidades:** Proveedores, Talleres Externos, Operarios Internos/Externos, Tarifario por categoría.
* **Regla Core:** Los operarios externos dependen obligatoriamente de un taller externo homologado.

### 3. Módulo de Operaciones y Control de Costos (El Motor)
* **Entidades:** Órdenes de Trabajo (OTs), Registro de Asistencia (Reloj Biométrico), Asignación de Personal (Imputación de Horas).
* **Regla Core:** Centraliza el "Triángulo del Costo" (Mano de obra, materiales y servicios terceros). n8n concilia automáticamente las horas de presencia (Reloj) contra las horas facturables (Imputación) para mitigar errores humanos. Soporta carga en bloque por cuadrillas.

### 4. Módulo de Logística y Suministros
* **Entidades:** Catálogo de Materiales, Inventario (Stock Físico/Virtual), Órdenes de Compra, Consumos por OT.
* **Regla Core:** Cada salida de pañol resta stock automáticamente. Las compras directas a obra esquivan el stock físico e impactan directo en el costo vivo de la OT.

### 5. Módulo Comercial (Presupuestos y Cierre)
* **Entidades:** Presupuestos (Cotizaciones), Anexos de Factura (Liquidación final).
* **Regla Core:** Clonación inteligente de presupuestos hacia anexos. Clasificación estricta mediante switch de ítems: "Mano de Obra" (Exento) o "Materiales" (Gravado con IVA) para automatizar el cálculo del PDF final.

### 6. Módulo de Cierre, Auditoría y Archivo Histórico
* **Jerarquía:** [BARCO] ➔ [VISITAS / PROYECTOS] ➔ [ÓRDENES DE TRABAJO].
* **Regla Core:** Data Locking automático por n8n. Cuando un lote de OTs pasa a estado "Facturado", el sistema bloquea y rebota cualquier intento de carga posterior. Divide los tableros en "Costo Vivo" (Obra actual) y "Costo Histórico" (Auditoría por año) para barcos recurrentes.
