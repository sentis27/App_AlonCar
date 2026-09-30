---
version: 1.0
last_updated_by: antigravity
last_updated: 2026-09-30
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

## 🔗 Vinculación con el Proyecto App_AlonCar

- **Módulo ERP Afectado:** `M2-recursos` (Operarios internos, externos, talleres contratistas).
- **Hoja de Ruta:** [ROADMAP_NEGOCIO.md](../../ROADMAP_NEGOCIO.md)
- **Seguimiento de Tareas:** [TAREAS_PENDIENTES.md](../../TAREAS_PENDIENTES.md)
