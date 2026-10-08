---
version: 1.1
last_updated_by: antigravity
last_updated: 2026-10-08
modulo: M2-recursos
---

# 📋 Proyecto: Perfil de Puesto y Matriz de Responsabilidades de Trabajo

## 🎯 Propósito y Alcance

Este documento establece la metodología, estructura de relevamiento y marco de análisis para llevar a cabo el mapeo de la estructura organizacional, tareas y responsabilidades del personal de **AlonCar**.

Forma parte del **Módulo 2 (Recursos / Mano de Obra)** del ERP Naval e Industrial, sentando las bases para:
1. **Definir Perfiles Laborales Claros:** Separar la función del individuo y formalizar responsabilidades.
2. **Construir la Matriz RACI:** Clarificar roles de ejecución, aprobación, consulta e información.
3. **Control y Optimización Operativa:** Identificar tareas repetitivas, cuellos de botella y oportunidades de automatización en el sistema.

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
| **Interacción** | Pañol (depósito), Supervisión (Jorge), Administración (María José), Talleres / Contratistas externos. |

#### Flujo Operativo: Ciclo de Trabajo con Talleres Externos (RPF/RMO ──> FCR)

1. **Definición & Cotización:** Omar analiza la necesidad de materiales y diseño del trabajo, busca talleres externos y negocia los precios.
2. **Emisión de Remito:** Emite remito en papel con duplicado (taller / archivo).
3. **Retiro de Pañol:** Si requiere materiales, el remito pasa por depósito para vincular Materiales ↔ Remito ↔ OT ↔ Barco.
4. **Revisión de Supervisión:** Jorge (Supervisión) revisa el remito y corrige inconsistencias habituales (ej. errores de número de OT).
5. **Carga Inicial (Administración):** María José ingresa el remito en la Planilla de Terceros como **RPF** (Remito Pdte. Factura) o **RMO** (Remito Mano de Obra).
6. **Auditoría de Factura (Omar):** Al recibir la factura del taller, Omar realiza el control manual comparando los montos facturados contra lo acordado/remitado y firma la conformidad.
7. **Cierre de Costo (Administración):** María José carga el N° de factura, actualiza el estado a **FCR** (Factura Remitada) y cierra el ciclo de costo.

#### Oportunidades de Mejora / Requerimientos ERP
- **Validación Estricta de OT:** En el alta digital de remitos, el sistema filtrará las OTs activas por Barco para evitar errores de imputación antes de la revisión de supervisión.
- **Asistencia Visual en Auditoría de Factura:** El ERP mantendrá la supervisión y firma manual de Omar como punto de decisión humano, facilitándole la lista ordenada de remitos RPF/RMO pendientes para su fácil cotejo con la factura recibida.

---

## 🔗 Vinculación con el Proyecto App_AlonCar

- **Módulo ERP Afectado:** `M2-recursos` (Operarios internos, externos, talleres contratistas).
- **Hoja de Ruta:** [ROADMAP_NEGOCIO.md](../../ROADMAP_NEGOCIO.md)
- **Seguimiento de Tareas:** [TAREAS_PENDIENTES.md](../../TAREAS_PENDIENTES.md)

