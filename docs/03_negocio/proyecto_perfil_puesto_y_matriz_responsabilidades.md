---
version: 1.2
last_updated_by: antigravity
last_updated: 2026-10-09
modulo: M2-recursos
---

# 📋 Proyecto: Perfil de Puesto y Matriz de Responsabilidades de Trabajo

## 🎯 Propósito y Alcance

Este documento establece la metodología, estructura de relevamiento y marco de análisis para llevar a cabo el mapeo de la estructura organizacional, tareas y responsabilidades del personal de **AlonCar**.

Forma parte del **Módulo 2 (Recursos / Mano de Obra)** del ERP Naval e Industrial, sentando las bases para:
1. **Definir Perfiles Laborales Claros:** Separar la función del individuo y formalizar responsabilidades.
2. **Construir la Matriz RACI:** Clarificar roles de ejecución, aprobación, consulta e información.
3. **Control y Optimización Operativa:** Identificar tareas repetitivas, cuellos de botella y oportunidades de automatización en el sistema.

> [!NOTE]
> **Regla de Mantenimiento Dinámico de Perfiles:** Conforme se descubren nuevas interacciones y flujos cruzados durante la descripción de puestos, los perfiles ya registrados se actualizan retroactivamente para reflejar el mapa completo de relaciones.

---

## 📑 1. Formato Estándar de Captura de Datos

El relevamiento inicial recopila la información bajo la siguiente plantilla de atributos por cada actividad:

| Atributo | Descripción / Regla |
| :--- | :--- |
| **Persona** | Nombre del colaborador que ejecuta la tarea. |
| **Área / Depto** | Unidad organizacional (*Taller, Operaciones, Mantenimiento, Administración, Comercial*). |
| **Cargo Actual** | Denominación o puesto informal actual. |
| **Tarea / Actividad** | Descripción atómica de la acción realizada. |
| **Frecuencia** | Periodicidad (*Diaria, Semanal, Mensual, Eventual / A demanda*). |
| **Tipo de Tarea** | Categoría (*Core/Ejecución, Gestión/Coordinación, Control/Supervisión, Administrativa*). |
| **Entradas (Insumos)** | Documento, orden o información requerida para iniciar la tarea. |
| **Salidas (Entregables)** | Resultado o producto generado (remito, pieza reparada, reporte, factura). |
| **Interacción con Terceros** | Coordinación interna/externa (clientes, proveedores, talleres externos, contratistas). |

---

## 🛠️ 2. Metodología de Implementación en 4 Fases

```
[ Fase 1: Recolección ] ──> [ Fase 2: Procesamiento ] ──> [ Fase 3: Perfiles & RACI ] ──> [ Fase 4: Control & Mejora ]
```

### Fase 1: Recolección de Información
- Carga de la lista de personas y desglose de sus actividades diarias y periódicas.

### Fase 2: Procesamiento y Clasificación
- Agrupación por **Procesos del Negocio** (Mantenimiento, M2 Recursos, Logística, Contabilidad, etc.).
- Identificación de carga horaria y volumen de repetición.

### Fase 3: Definición de Perfiles y Matriz RACI
- **Abstracción del Rol:** Agrupar tareas en Perfiles de Puesto estandarizados.
- **Matriz RACI por Proceso:**
  - **R (Responsible):** Quien realiza la tarea.
  - **A (Accountable):** Quien responde y aprueba el resultado final.
  - **C (Consulted):** Quien aporta información clave para la ejecución.
  - **I (Informed):** Quien recibe notificaciones del estado.

### Fase 4: Control y Mejora Continua
- Detección de solapamientos (dos personas haciendo lo mismo) y lagunas de responsabilidad.
- Vinculación con los módulos del ERP y workflows (n8n) para digitalizar y automatizar tareas administrativas.

---

## 👥 3. Relevamiento de Personal y Perfiles de Puesto

### Puesto 01: Proyectista Técnico y Gestor de Subcontratos

| Atributo | Detalle |
| :--- | :--- |
| **Persona** | Omar |
| **Área / Depto** | Operaciones / Oficina Técnica |
| **Cargo Propuesto** | Proyectista Técnico y Gestor de Subcontratos |
| **Frecuencia** | Diaria |
| **Tipo de Tarea** | Core (Diseño/Ingeniería) + Gestión (Talleres) + Control (Facturación de Terceros) |
| **Entradas (Insumos)** | Petición verbal de trabajo nuevo (diseño de piezas/sistemas, ej. cintas lavadoras de pescado) |
| **Salidas (Entregables)** | 1. Especificación de materiales y diseño técnico.<br>2. Remito firmado (original para taller, duplicado para archivo).<br>3. Factura de taller auditada y firmada para pago. |
| **Interacción** | Pañol (Mariano / Rodrigo - entrega de materiales y remitos), Supervisión (Jorge), Administración (María José), Talleres / Contratistas externos. |

#### Flujo Operativo: Ciclo de Trabajo con Talleres Externos (RPF/RMO ──> FCR)

1. **Definición & Cotización:** Omar analiza la necesidad de materiales y diseño del trabajo, busca talleres externos y negocia los precios.
2. **Emisión de Remito:** Emite remito en papel con duplicado (taller / archivo).
3. **Retiro de Pañol:** Si requiere materiales, el remito pasa por depósito (Mariano/Rodrigo) para vincular Materiales ↔ Remito ↔ OT ↔ Barco.
4. **Revisión de Supervisión:** Jorge (Supervisión) revisa el remito y corrige inconsistencias habituales (ej. errores de número de OT).
5. **Carga Inicial (Administración):** María José ingresa el remito en la Planilla de Terceros como **RPF** (Remito Pdte. Factura) o **RMO** (Remito Mano de Obra).
6. **Auditoría de Factura (Omar):** Al recibir la factura del taller, Omar realiza el control manual comparando los montos facturados contra lo acordado/remitado y firma la conformidad.
7. **Cierre de Costo (Administración):** María José carga el N° de factura, actualiza el estado a **FCR** (Factura Remitada) y cierra el ciclo de costo.

---

### Puesto 02: Encargados de Pañol y Control de Materiales

| Atributo | Detalle |
| :--- | :--- |
| **Personas** | Mariano y Rodrigo |
| **Área / Depto** | Pañol / Logística y Despacho de Materiales |
| **Cargo Propuesto** | Encargados de Pañol y Control de Materiales |
| **Frecuencia** | Diaria |
| **Tipo de Tarea** | Core (Despacho y Recepción de Mercadería) + Administración de Stock + Control Auditor |
| **Entradas (Insumos)** | 1. Petición oral de materiales en ventanilla.<br>2. Remitos físicos para entrega/vinculación de materiales (emitidos por Omar o asociados a OTs).<br>3. Remitos de proveedores para control de recepción.<br>4. Mensajes del grupo de WhatsApp *"Chapa Aloncar"* (insumo de chapas).<br>5. Mensajes del grupo de WhatsApp *"Grupo de Pañoleros"* enviados por Jorge (Supervisor) para carga de materiales **PRFV** (Plástico Reforzado con Fibra de Vidrio). |
| **Salidas (Entregables)** | 1. Despacho físico de materiales a obra/contratistas.<br>2. Carga de retiros en la Planilla de Materiales (`MATERIALES_PLANILLAS_REGISTRO`).<br>3. Carga de solicitudes en la Planilla de Compras.<br>4. Remitos físicos firmados como sello de constancia de carga en el sistema.<br>5. Registro impreso de auditoría física en la hoja `REG.CONTROL DE STOCK` (copia de respaldo). |
| **Interacción** | Supervisión (Jorge - WhatsApp PRFV y resolución de mermas), Proyectista (Omar - materiales de remitos), Talleres/Contratistas, Maquinista (movimiento de carga pesada), Fletero (Jorge Giorgetti). |

#### Flujos Operativos del Pañol

1. **Despacho a Obra / Remito Omar:** Recepción de solicitud (oral o remito físico) ──► Entrega física de material ──► Carga en Planilla de Materiales ──► Firma física del remito como sello de control.
2. **Recepción de Proveedores / Fletero:** Llegada del fletero (Jorge Giorgetti) ──► Apoyo del Maquinista para movimiento de materiales pesados ──► Control vs. remito de proveedor ──► Carga en Planilla de Compras.
3. **Canales de Entrada Digital (WhatsApp):**
   - *Grupo "Chapa Aloncar":* Notificación de chapas ──► Imputación a Barco/Proyecto.
   - *Grupo "Pañoleros" (Jorge):* Indicación de Jorge ──► Carga de materiales PRFV a la OT/Barco correspondiente.
4. **Control e Inventario de Stock (`REG.CONTROL DE STOCK`):**
   - Realizan el recuento físico de materiales vs. el stock teórico del sistema.
   - Generan un comprobante/copia física de respaldo de la planilla digital.
   - **Regla de Resolución de Diferencias:**
     - *Si Físico > Sistema:* Dan entrada directa (ajuste positivo de stock).
     - *Si Físico < Sistema:* Notifican inmediatamente a Supervisión (Jorge) para que él investigue la merma y resuelva la diferencia.

#### Oportunidades de Mejora / Requerimientos ERP
- **Firma Digital en Terminal Pañol:** Sustituir la firma de remitos en papel por un botón de *"Despachado / Imputado"* en la terminal del pañol.
- **Workflow n8n de Captura WhatsApp (PRFV y Chapas):** Pre-procesar los mensajes de Jorge (PRFV) y del grupo *"Chapa Aloncar"* para convertirlos automáticamente en borrador de retiro en el ERP.
- **Mapeo Automático de Diferencias de Stock:** Integrar el registro del conteo con sugerencia automática de ajuste positivo y alerta directa a Jorge en caso de mermas.

---

## 🔗 Vinculación con el Proyecto App_AlonCar

- **Módulo ERP Afectado:** `M2-recursos` (Operarios internos, externos, talleres contratistas) y `M4c-control-inventario`.
- **Hoja de Ruta:** [ROADMAP_NEGOCIO.md](../../ROADMAP_NEGOCIO.md)
- **Seguimiento de Tareas:** [TAREAS_PENDIENTES.md](../../TAREAS_PENDIENTES.md)


