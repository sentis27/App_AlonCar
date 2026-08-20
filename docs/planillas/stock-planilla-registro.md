# 📦 CONTROL DE STOCK — Planilla de Registro (Análisis y Mapeo)

## 1. Información General
- **Nombre Original:** CONTROL DE STOCK
- **URL / ID:** `https://docs.google.com/spreadsheets/d/1GqgD9YdJsACnfLj_yAXlYLDXi_KfaL42t_vg0er5Doo/edit`
- **Módulo:** M4c (Control de Inventario)
- **Propietario Principal:** Pañolero / Supervisor
- **Frecuencia de Uso:** Diario (entradas, auditorías) y Consultas puntuales.

## 2. Objetivo de la Planilla
Esta planilla es el núcleo central para el cálculo y auditoría del inventario físico. Su propósito es consolidar las entradas (compras y ajustes) y salidas (retiros de pañol), brindar un balance actual (`STOCK FISICO`), y mantener un historial de auditorías (`REG.CONTROL DE STOCK`) para detectar discrepancias entre el sistema y la realidad física. Además, proporciona herramientas estadísticas (`CALCULO DE PEDIDO`) para proyectar cuándo se agotará un material basado en su consumo histórico.

---

## 3. Arquitectura de Hojas (Estructura Actual)

La planilla funciona como un agregador complejo con las siguientes hojas principales:

### 3.1 📥 ENTRADAS
- **Propósito:** Hoja para realizar asientos manuales de entrada/salida de materiales.
- **Uso real:** Generalmente se usa como una "puerta trasera" para hacer **ajustes por control de stock** (ej. "AJUSTE POR CONTROL, ARIEL"). Permite inicializar stock de ítems que nunca se controlaron, o corregir errores (mediante cantidades positivas o negativas).
- **Columnas clave:** `FECHA`, `MATERIAL`, `CANTIDAD`, `OBSERVACIONES`.

### 3.2 📊 CONTROL STOCK
- **Propósito:** La base de datos central que agrupa todo el inventario. Muestra el estado en tiempo real de cada ítem.
- **Mecánica actual:** Se alimenta de las importaciones (`IMPORT. COMPRAS`, `IMPORT. MATERIALES`). Calcula el stock mediante la resta matemática de entradas (compras + ajustes positivos) menos salidas (retiros + ajustes negativos).
- **Columnas clave:** `RUBRO`, `MATERIAL`, `Entradas`, `Salidas`, `STOCK FISICO`, `STOCK VIRTUAL`, `STOCK MINIMO`, `ALARMA` (FALTA / OK), `COSTO`.

### 3.3 📝 REG.CONTROL DE STOCK
- **Propósito:** Bitácora inmutable de auditorías físicas.
- **Mecánica actual:** Cuando el pañolero cuenta físicamente un ítem, registra cuánto dice el sistema vs. cuánto hay realmente.
- **Columnas clave:** `FECHA`, `MATERIAL`, `CANTIDAD (STOCK)`, `CANTIDAD (REAL)`, `ESTADO DEL CONTROL` (OK/ERROR).
- **KPIs en hoja:** Tiene estadísticas globales de porcentaje de acierto ("DATOS CORRECTOS" vs "DATOS CON ERROR").

### 3.4 📈 CALCULO DE PEDIDO
- **Propósito:** Analítica predictiva para asistir a Compras.
- **Mecánica actual:** Define un rango de fechas (`FECHA INICIAL` y `FECHA FINAL`) y calcula el consumo en ese período. Luego compara el consumo con el stock actual para obtener la "Vitalidad" (cuánto tiempo rendirá el material). 
- **Columnas clave:** `MATERIAL`, `CONSUMO`, `STOCK`, `VITALIDAD`, `PEDIDO`, `VIT. PEDIDO + STOCK`.

---

## 4. Problemas Identificados y Soluciones Propuestas

### 4.1 🟡 Estandarización de Ajustes (ENTRADAS)
**Problema:** Los ajustes manuales en la hoja ENTRADAS se cargan con descripciones libres (ej. "AJUSTE POR CONTROL, JORGE"). No hay un catálogo tipificado de motivos de ajuste.
**Solución propuesta:**
- Crear una tabla `stock_adjustments` que requiera seleccionar un `reason_type` estandarizado (Ej: `INVENTORY_CHECK`, `DAMAGE`, `INITIALIZATION`, `OTHER`).
- El usuario que realiza el ajuste quedará registrado automáticamente mediante el log de auditoría del sistema (FK a `users`), eliminando la necesidad de escribir el nombre en la observación.

### 4.2 🟡 Registro de Controles Desvinculado del Ajuste y Carga Manual Uno a Uno
**Problema:** Actualmente, si un control de stock (REG.CONTROL DE STOCK) da ERROR, el operario debe ir a la hoja ENTRADAS a realizar el ajuste compensatorio de forma manual, haciendo las restas mentalmente. Además, cargar ítems de a uno es lento cuando se audita un rubro entero.
**Solución propuesta:**
- **Auditoría en Lote (Por Rubro):** La interfaz permitirá seleccionar uno o varios "Rubros" (ej: Planchuelas y Caños). El sistema traerá automáticamente a la vista de auditoría todos los materiales de esos rubros con su stock actual teórico.
- **Cálculo de Diferencia Automático:** Al ingresar la cantidad física contada (`counted_quantity`), el sistema calculará instantáneamente la diferencia (`counted_quantity - system_quantity`).
- **Ajuste en 1-Clic:** Si hay diferencia, la interfaz mostrará la sugerencia exacta del ajuste (positivo o negativo) y permitirá crear el `stock_adjustment` compensatorio con un solo botón, unificando el control y el ajuste en el mismo paso.

### 4.3 🟡 Valorización del Inventario (NUEVO)
**Problema:** El control de stock debe permitir conocer cuánto dinero representa el inventario (físico y mermas).
**Solución propuesta:**
- Cada registro de stock y ajuste multiplicará la cantidad por el **precio unitario actual** del material (proveniente de la B.D MATERIALES o su último precio de compra).
- El sistema ofrecerá un reporte ágil de "Valorización de Inventario", permitiendo ver cuánto capital está inmovilizado en stock y cuánto dinero se "perdió" o "ganó" tras un ajuste por control.

### 4.4 🟡 Estados del Material (NUEVO)
**Problema:** No todos los materiales en stock están en las mismas condiciones para ser usados.
**Solución propuesta:**
- Añadir el concepto de **Estado del Material** (`material_condition` o `status`) en el sistema.
- Estados propuestos: `DISPONIBLE` (listo para usar), `EN CUARENTENA` (pendiente de revisión técnica), `OBSOLETO` (ya no se usa pero ocupa espacio), `DAÑADO` (para descarte).
- Durante el control o ajuste, el operario podrá categorizar si una merma es porque el material se rompió (pasa a `DAÑADO`) o si simplemente faltaba.

### 4.5 🟡 Cálculo de Pedido (Estadística de Consumo)
**Problema:** La hoja de "Cálculo de Pedido" es pesada al ser calculada mediante fórmulas en Sheets.
**Solución propuesta:**
- Trasladar esta lógica a una **Vista Estadística / Dashboard** en el Frontend.
- El usuario selecciona un período de fechas, y el backend calcula el consumo sumando los retiros de pañol (tabla `inventory_transactions` o `work_order_materials`).
- Se presentará la métrica "Días de Inventario Restante" (Vitalidad).

---

## 5. Mapeo a Entidades del Sistema Nuevo

El concepto monolítico de "CONTROL STOCK" desaparece como tabla estática y pasa a ser un estado derivado o una tabla de agregación (vista materializada).

### Tabla `stock_adjustments` (Reemplaza hoja ENTRADAS)
| Campo Sistema | Origen en Sheets | Notas |
|--------------|------------------|-------|
| `id` | Autogenerado | UUID |
| `date` | FECHA | DATE |
| `material_id` | MATERIAL | FK a `materials.id` |
| `quantity` | CANTIDAD | DECIMAL (Puede ser negativo o positivo) |
| `reason_type` | OBSERVACIONES | ENUM: `AUDIT_CORRECTION`, `DAMAGE`, `INITIALIZATION`, `OTHER` |
| `notes` | OBSERVACIONES | Texto libre complementario |
| `created_by` | OBSERVACIONES (Nombre) | FK a `users.id` |

### Tabla `stock_audits` (Reemplaza hoja REG.CONTROL DE STOCK)
| Campo Sistema | Origen en Sheets | Notas |
|--------------|------------------|-------|
| `id` | Autogenerado | UUID |
| `date` | FECHA | DATE |
| `material_id` | MATERIAL | FK a `materials.id` |
| `system_quantity` | CANTIDAD (STOCK) | DECIMAL (Stock virtual al momento del control) |
| `counted_quantity` | CANTIDAD (REAL) | DECIMAL (Stock físico contado) |
| `calculated_delta` | Col G | DECIMAL (Calculado: counted_quantity - system_quantity). Sugerencia de ajuste. |
| `status` | ESTADO DEL CONTROL | ENUM: `OK`, `DISCREPANCY` (Derivado matemáticamente) |
| `adjustment_id` | - | FK a `stock_adjustments.id` (El ajuste automático que resolvió la discrepancia, si aplica) |
| `audited_by` | - | FK a `users.id` |

### Entidad Lógica `inventory` (La vista de CONTROL STOCK)
El inventario actual (Stock Físico) ya no requiere una tabla separada que se actualiza manualmente, sino que se calcula/materializa a partir de:
`Stock Físico = SUM(purchase_orders.quantity WHERE status = RECIBIDO) + SUM(stock_adjustments.quantity) - SUM(salidas_de_panol.quantity)`
*(El modelo exacto dependerá de la arquitectura del ERP, típicamente se usa una tabla `inventory_balances` que se actualiza por triggers/eventos de transacciones).*

---

## 6. Siguientes Pasos
- Validar con el usuario si el flujo unificado de Auditoría -> Ajuste Automático es correcto.
- Analizar las salidas de pañol (Planilla MATERIALES - GS-002) para completar el triángulo del inventario (Entradas + Ajustes - Salidas).
