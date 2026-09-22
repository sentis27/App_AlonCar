# ⚓ Reglas de Negocio Transversales

Este documento consolida las reglas operativas y de negocio que aplican de forma global a todos los módulos del sistema (Activos, Recursos, Operaciones, Logística, Comercial y Analítica).

## 1. Gestión de Trabajos Internos y de Infraestructura

Las labores propias de mantenimiento del astillero (ej. mantenimiento de predio, reparación de equipos, operación de varadero) tienen un impacto directo en el consumo de recursos (pañol, horas de personal) pero no se facturan a un cliente externo. Para mantener la contabilidad aislada y permitir la analítica de costos, aplican las siguientes reglas:

### 1.1. El Cliente Interno "ASTILLERO"
Todos los trabajos, proyectos o consumos propios deben imputarse obligatoriamente a un cliente y barco ficticio denominado **"ASTILLERO"**. 
- Esta separación estructural asegura que los costos operativos internos nunca se mezclen accidentalmente en anexos de facturación comercial.
- Aplica para todo: desde OTs de mantenimiento continuo hasta OTs de proyectos internos (ej. "Construcción Galpón Nuevo") o trabajos de garantías cruzadas.

### 1.2. Agrupación Analítica Dinámica (Sin Nomenclatura Manual)
El sistema **no** requiere que el usuario agregue el año o período manualmente al nombre de la OT (ej. **NO** es necesario escribir "MANTENIMIENTO PREDIO - 2026").
- **Nombre estándar:** La OT se nombra de manera simple y constante a lo largo del tiempo (ej. "MANTENIMIENTO PREDIO").
- **Corte analítico automático:** Al consultar el *Comparador de Obras* o los reportes del módulo de Analítica, el sistema agrupa y separa los costos por año automáticamente leyendo la fecha real de la imputación (la fecha en que se cargaron las horas o los materiales). Esto permite comparar de forma nativa el costo anual de mantenimiento entre 2025, 2026 y 2027 sin ensuciar la base de datos con decenas de OTs duplicadas por calendario.

## 2. Comunicación Interna en Órdenes de Trabajo (Botón "Ampliar")
En la ficha detallada de cada Orden de Trabajo (M3), se incluye un botón interactivo **"Ampliar"**:
- **Función:** Permite a cualquier supervisor u operario solicitar una aclaración formal de texto libre al Jefe de Obra responsable sobre tareas específicas o alcance no especificado.
- **Flujo:** La consulta genera una notificación interna dirigida al Jefe de Obra y queda registrada como un hilo de comunicación adjunto a la OT para trazabilidad futura.

---

## 3. Reglas de Pañol y Retiros de Materiales (M4 Logística)

### 3.1. Separación de Roles: Pañolero vs. Administración
- El Pañolero (responsable de la entrega física de materiales) **no visualiza** el campo `Centro de Costo` ni montos monetarios (son datos administrativos/contables).
- **Datos visibles para el Pañolero:**
  1. **Stock Disponible Real** del material seleccionado.
  2. **Leyenda `"Material sin control de stock"`** si el ítem no posee seguimiento de inventario.
  3. **Vitalidad del Material:** Indicador calculado en días/semanas basado en los retiros promedio de las últimas semanas versus el stock disponible.
  4. **Selección de Operario que Retira:** Selector activo (dropdown) con autocomplete para elegir la persona real que retira el material.
  5. **Fecha Editable:** Valor por defecto = `Hoy`, pero permite modificación manual para registros retrospectivos.

### 3.2. Botón Directo "Solicitar Compra" desde Pañol
Si el stock es insuficiente o crítico, el pañolero cuenta con el botón **"Solicitar Compra"**:
- Crea automáticamente una fila en `purchase_orders` (M4b).
- Completa por defecto: `requested_by` = Pañolero, `ship_id` = `ASTILLERO`, `work_order_id` = `STOCK`.
- Deja el campo `quantity` y `supplier_id` abiertos para que el Encargado de Compras complete la gestión.

### 3.3. Deducción Automática de Unidades por Nomenclatura
El campo manual de unidades no es necesario en el formulario; el sistema deduce la unidad automáticamente según el nombre estandarizado del material:
- Contiene `"x Metro"` $\rightarrow$ Unidad: **Metros** (ej. planchuelas, caños, ángulos, macizos).
- Contiene `"x Kilo"` $\rightarrow$ Unidad: **Kilos** (ej. bronce).
- Contiene `"Lado x Lado"` $\rightarrow$ Unidad: **Dimensiones / Placa**.
- Sin sufijo de medida $\rightarrow$ Unidad: **Unitario** (piezas, repuestos).

### 3.4. Carga Múltiple de Materiales por Remito de Pañol
El formulario de Pañol permite seleccionar la OT una sola vez y agregar una grilla con **múltiples materiales** en la misma transacción, generando un único remito interno de salida. Al seleccionar la OT, la interfaz muestra en pantalla la **descripción completa del trabajo** para ayudar al pañolero a verificar la OT correcta.

---

## 4. Flujo de Compras y Automatización de Pedidos a Proveedores (M4b Compras)

### 4.1. Visibilidad por Nivel de Acceso
- **Nivel Carga / Pañolero:** Solo visualiza el formulario de necesidad (Material, Cantidad solicitada, Solicitante). No ve estadísticas de precios ni datos de proveedores.
- **Nivel Encargado de Compras:** Visualiza gráficos comparativos de precios, estadísticas históricas de compras por proveedor y estado de cotizaciones.

### 4.2. Motor de Automatización de Envíos a Proveedores
1. **Selección Múltiple:** El Encargado de Compras tilda los materiales en estado `PEDIR`.
2. **Disparo de Algoritmo ("Pedir Materiales"):** El sistema agrupa automáticamente los materiales seleccionados según su proveedor asignado (ej. 3 materiales a *Cerremaq*, 2 a *Ferretería Florida*).
3. **Generación de Mensaje:** Consulta el medio de contacto registrado en `suppliers` (Email o WhatsApp) y redacta un mensaje formal con el listado agrupado.
4. **Transición de Estado:** Las solicitudes seleccionadas cambian su estado de `PEDIR` a `PEDIDO`.
5. **Trazabilidad de Auditoría:** El log del sistema registra si el pedido fue realizado por la automatización (`created_by_automation = true`) o manualmente por un operario.

---

## 5. Estándar de Idioma de la Plataforma (UI / UX)
Toda la interfaz de usuario (UI), notificaciones, alertas, mensajes del asistente de IA y exportaciones (PDF, Excel) deben estar estricta y obligatoriamente en **ESPAÑOL**. 
- **Cero tolerancia al Spanglish:** Términos como "Dashboard", "Work Order", "Submit", "Loading" deben traducirse a sus equivalentes precisos en español (ej. Panel de Control, Orden de Trabajo, Enviar, Cargando). 
- El personal del astillero, desde pañol hasta gerencia, requiere una herramienta nativa en su idioma que no genere fricción cognitiva.
