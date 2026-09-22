# Tabla de Tablas v7 — Especificación Técnica Definitiva para Supabase

> **Versión:** 7.0 (Actualizada con escaneo profundo de GS-006 Compras, GS-007 Stock, GS-008 B.D.NewSystemm, GS-009/010 Reconciliación, GS-004 Resumen Gerencial y Sistema de Revisión/Tickets)  
> **Última actualización:** 2026-08-21  
> **Estado:** ✅ Mapeo Completo e Integrado  
> **Convención:** Cada campo técnico incluye su analogía en español entre paréntesis.  
> **Guía de lectura:** Las secciones con **🆕 NUEVO v7** o **🔄 ACTUALIZADO v7** contienen las incorporaciones de las planillas recientemente mapeadas.

---

## 1. Filosofía de Diseño y Principios Generales

### Principio 1 — El usuario nunca toca la base de datos directamente
Toda interacción ocurre a través de interfaces controladas:
- **Formularios de Alta:** Para ingresar datos nuevos (validados, dropdowns dinámicos).
- **Grilla de Edición Inline:** Para corregir y analizar datos en tiempo real (DEC-014/015).

### Principio 2 — Modos de Edición Dual
1. **Modo Grilla (Inline):** Vista tabular estilo Zoho/Excel. Edición celda a celda o pegado masivo según nivel de permiso.
2. **Modo Formulario (Guiado):** Filtros secuenciales para encontrar un registro puntual.

### Principio 3 — Flujo de Selección Universal: Barco primero, siempre
En TODOS los formularios de carga (horas, terceros, materiales, compras):
1. **Barco** → Selección primaria obligatoria (NUNCA se deduce).
2. **Taller/Persona** → Filtrado por los habilitados para ese barco.
3. **OT** → Filtrada por la combinación Barco + Taller/Persona.

> **Casos especiales:** OTs estándar como "Varadero" existen para múltiples barcos. Al seleccionar el barco primero, el sistema filtra a la OT Varadero de ESE barco. Si una OT cambia de nombre (ej: "Parches" → "Modificación de Banda"), el cambio se hace en la OT (M3) y su `id` único actualiza todas las vistas automáticamente.

### Principio 4 — Login Único y Menú Dinámico
El frontend consulta `get_user_permissions()` y ajusta la UI mostrando solo las herramientas habilitadas para los 4 niveles de permisos.

### Principio 5 — Auditoría Automática y Trazabilidad (DEC-012/DEC-015)
Toda modificación guarda `before_values` y `after_values` en `audit_logs` con retención de 1 año. Los históricos consolidados no se eliminan.

### Principio 6 — Grilla como Interfaz Principal (DEC-015)
Análisis mediante vistas tabulares con filtros laterales, paginación y búsqueda con autocomplete universal.

### Principio 7 — Observaciones en TODOS los Formularios
Toda tabla y formulario contiene obligatoriamente un campo `notes` (Observaciones) de texto largo libre.

### Principio 8 — Leyendas de Ayuda Interactivas (DEC-017)
Tooltips explicativos en selectores críticos (ej: Tipos de Comprobante en Terceros, Estados de OT en Operaciones, Estados de Pedido en Compras).

### Principio 9 — Habilitación de Talleres/Personas por Planilla
Cada taller u operario tiene flags de habilitación (`enabled_hours`, `enabled_materials`, `enabled_third_party`, `enabled_purchases`) que filtran su presencia en los dropdowns correspondientes.

### 🆕 NUEVO v7 — Principio 10 — Sistema de Revisión y Auditoría por Tickets (`revision_planillas.md`)
1. **Flujo de Tickets (💬 ↔ 🔔):** El supervisor puede realizar correcciones *in-situ* (que van al log) o emitir un **Ticket de Revisión** sobre una fila. La fila cambia a estado `Observado`.
2. **Ciclo de Vida de Revisión:**
   - Supervisor crea ticket → Fila pasa a `Observado`.
   - Operario recibe alerta 🔔 → Ve vista filtrada solo de sus filas en `Observado` → Corrige y responde → Fila pasa a `Corregido_Pendiente_Aprobacion`.
   - Supervisor revisa diff (`[Viejo] → [Nuevo]`) → Aprueba (pasa a `Aprobado`) o rechaza (vuelve al operario).
3. **Mecanismo de Bloqueo (Row Locking):** Al abrir o auditar una fila, esta se bloquea para el otro usuario evitando colisiones en tiempo real.
4. **Operaciones Especiales de Revisión:**
   - **Bulk Approval:** Aprobación masiva con checkboxes para el supervisor.
   - **Soft-Delete vía Ticket:** Operario solicita baja → Supervisor la ejecuta (Soft-Delete con historial).
   - **Split de Filas:** Supervisor puede desdoblar una fila (ej: 10hs en dos filas de 5hs para distintas OTs).

---

## 2. Convenciones Técnicas Obligatorias

### Estructura Mínima de Tabla Privada
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
created_at          timestamptz DEFAULT now(),
updated_at          timestamptz DEFAULT now(), -- via moddatetime
created_by_user_id  uuid REFERENCES auth.users(id),
is_active           boolean DEFAULT true,
notes               text, -- Observaciones universales
review_status       text DEFAULT 'Aprobado' -- 🆕 NUEVO v7: Aprobado, Observado, Corregido_Pendiente_Aprobacion
```

### Niveles de Permiso

| Nivel | Nombre | Funciones | UI en Grilla |
|---|---|---|---|
| 1 | `read` | SELECT en vistas `*_grid` | Solo lectura. Sin ✏️ ni 🗑️. |
| 2 | `edit` | `insert_*` y `update_*` | Edición inline con ✏️. Sin borrar filas. |
| 3 | `delete` | Soft Delete, Unlock OT, Tickets, Split | Ve ✏️ y 🗑️. Puede desdoblar y borrar filas. |
| 4 | `admin` | Acceso global y gestión de usuarios | Todas las funciones y configuración de parámetros. |

---

## 3. ESPECIFICACIÓN POR MÓDULOS

---

### M1 — Activos y Clientes (Bases Históricas)

> **Tipo:** Base Histórica (las grillas `*_grid` muestran siempre todos los registros).

#### Tabla: `owners` (Razones Sociales / Propietarios)
- `id` (ID Único): `uuid PK`
- `name` (Nombre / Razón Social): `text NOT NULL`
- `cuit` (CUIT): `text`
- `contact_email` (Email Contacto): `text`
- `contact_phone` (Teléfono Contacto): `text`
- `notes` (Observaciones): `text`
- `is_active` (¿Activo?): `boolean`

#### Tabla: `ships` (Barcos)
- `id` (ID Único Barco): `uuid PK`
- `owner_id` (Razón Social Propietaria): `uuid FK → owners`
- `name` (Nombre del Barco): `text NOT NULL`
- `imo_number` (Número IMO): `text`
- `vessel_type` (Tipo Embarcación): `text`
- `technical_specs` (Ficha Técnica Dinámica): `jsonb` (Almacena componentes dinámicos: válvulas, tanques, pocetes, etc.)
- `notes` (Observaciones): `text`
- `is_active` (¿Activo?): `boolean`

#### Tabla: `contacts` (Contactos de Clientes)
- `id` (ID Único): `uuid PK`
- `owner_id` (Razón Social): `uuid FK → owners`
- `name` (Nombre Contacto): `text`
- `role` (Cargo / Rol): `text` (Ej: Capitán, Encargado)
- `email` (Email): `text`
- `phone` (Teléfono): `text`

---

### 🔄 ACTUALIZADO v7 — M2 — Recursos y Padrón Maestro (`bd-newsystemm.md` — GS-008)

> **Estado:** ✅ Escaneo Profundo Confirmado.

#### Tabla: `workers` (Operarios e Personal Propio)
- `id` (ID Único Operario): `uuid PK`
- `name` (Nombre y Apellido): `text NOT NULL`
- `dni` (DNI / Documento): `text`
- `workshop_id` (Taller / Contratista Asignado): `uuid FK → workshops` (NULL si es planta propia)
- `category_id` (Categoría Salarial): `uuid FK → worker_categories` (Oficial, Medio Oficial, Ayudante)
- `default_trade` (Rubro Principal): `text` (Raschinaje, Calderería, Pintura, Mecánica)
- `work_group` (Grupo de Trabajo / Centro Admin): `text` (ASTILLERO, CONTRATISTA, TALLER)
- `can_withdraw_materials` (Permiso Carga Materiales): `boolean` (SI/NO)
- `can_impute_hours` (Permiso Imputación Horas): `boolean` (SI/NO)
- `enabled_hours` / `enabled_materials` / `enabled_third_party` / `enabled_purchases`: `boolean` (Flags por planilla)
- `is_active` (Estado Operario): `boolean` (Soft Delete para bajas)

#### Tabla: `workshops` (Talleres Externos / Contratistas)
- `id` (ID Único Taller): `uuid PK`
- `name` (Nombre Taller / Razón Social): `text NOT NULL`
- `cuit` (CUIT): `text`
- `is_approved` (Homologado): `boolean`
- `consumables_discount_pct` (% Descuento Consumibles): `numeric` (0% a 100% — DEC-009)
- `safety_items_discount_pct` (% Descuento Elem. Seguridad): `numeric` (100% por defecto)
- `enabled_hours` / `enabled_materials` / `enabled_third_party` / `enabled_purchases`: `boolean`

#### Tabla: `worker_categories` (Categorías Salariales)
- `id`: `uuid PK`
- `name` (Categoría): `text` (Oficial, 1/2 Oficial, Ayudante, Aprendiz, Mandados)

#### Tabla: `rate_cards` (Tarifario Salarial Quincenal)
- `id`: `uuid PK`
- `category_id`: `uuid FK → worker_categories`
- `workshop_id`: `uuid FK → workshops` (Nullable, si la tarifa es de contratista específico)
- `hourly_rate_ars` (Valor Hora ARS): `numeric`
- `hourly_rate_usd` (Valor Hora USD): `numeric` (Calculado según dólar quincenal)
- `fortnight_period` (Quincena Vigencia): `text` (Ej: `2026-08-Q1`)

---

### 🔄 ACTUALIZADO v7 — M3 — Operaciones y Control de Costos

#### Tabla: `work_orders` (Órdenes de Trabajo — GS-003)
- `id` (ID Único OT): `uuid PK`
- `ship_id` (Barco): `uuid FK → ships`
- `title` (Título OT): `text NOT NULL`
- `description` (Descripción Detallada): `text` (Aparece en Tooltip DEC-016)
- `status` (Estado OT): `text` (`open`, `in_progress`, `pending_remito`, `remito_approved`, `completed`, `invoiced`, `closed`)
- `work_type` (Tipo Computación Horas): `text` (`HORA`, `PRESUPUESTO`, `CONTROL`)
- `start_date` (Fecha Inicio): `date`
- `auto_copy_to_third_party` (Auto-copiar a Terceros): `boolean`
- `notes` (Observaciones): `text`

#### Tabla: `work_order_workshops` (Talleres Asignados a la OT)
- `id`: `uuid PK`
- `work_order_id`: `uuid FK → work_orders`
- `workshop_id`: `uuid FK → workshops`

#### 🔄 ACTUALIZADO v7 — Tabla: `time_entries` (Imputación de Horas — GS-001)
- `id` (ID Único): `uuid PK`
- `ship_id` (Barco): `uuid FK → ships` (Selección primaria)
- `work_order_id` (OT): `uuid FK → work_orders`
- `worker_id` (Operario / Persona): `uuid FK → workers`
- `workshop_id` (Taller / Grupo): `uuid FK → workshops`
- `work_date` (Fecha): `date`
- `trade` (Rubro ejecutado hoy): `text` (Manual por fila: Calderería, Pintura, etc.)
- `work_type` (Tipo Trabajo): `text` (Deducido de OT)
- `hours_worked` (Horas Trabajadas): `numeric`
- `hourly_rate_usd` (Valor Hora USD): `numeric` (Tomado de RateCard quincenal)
- `total_cost_usd` (Costo Total USD): `numeric` (`hours_worked × hourly_rate_usd` — Guardado)
- `approval_status` (Aprobación Legacy): `text` (`S`, `R`, `RR`, `RRR`)
- `review_status` (Estado Revisión): `text` (`Aprobado`, `Observado`, `Corregido_Pendiente_Aprobacion`)

#### Tabla: `third_party_works` (Planilla de Terceros — GS-005)
- `id`: `uuid PK`
- `work_date` (Fecha): `date`
- `ship_id` (Barco): `uuid FK → ships`
- `work_order_id` (OT): `uuid FK → work_orders`
- `workshop_id` (Taller Proveedor): `uuid FK → workshops`
- `trade` (Rubro Taller): `text` (JOIN automático)
- `voucher_type` (Tipo Comprobante): `text` (`FCR`, `PRC`, `RMO`, `RPF`, `SDT` con tooltips DEC-017)
- `voucher_number` (N° Comprobante): `text`
- `internal_remito_number` (N° Remito Aloncar): `text`
- `description` (Descripción Trabajo): `text`
- `cost_ars` / `cost_usd`: `numeric`
- `prc_status` (Estado PRC): `text`
- `attachment_url` (Adjunto Google Drive): `text`
- `review_status`: `text`

#### 🆕 NUEVO v7 — Tabla: `review_tickets` (Sistema de Tickets de Auditoría)
- `id` (ID Ticket): `uuid PK`
- `target_table` (Tabla Afectada): `text` (`time_entries`, `material_consumption`, `third_party_works`)
- `target_record_id` (ID Fila Afectada): `uuid`
- `created_by` (Emisor Ticket): `uuid FK → auth.users` (Supervisor u Operario)
- `assigned_to` (Receptor Alerta): `uuid FK → auth.users`
- `message` (Mensaje / Observación): `text`
- `status` (Estado Ticket): `text` (`OPEN`, `RESOLVED`, `CLOSED`)
- `old_value_snapshot` (Foto Valor Anterior): `jsonb`
- `new_value_snapshot` (Foto Valor Nuevo): `jsonb`

#### 🆕 NUEVO v7 — Bandeja de Reconciliación Horas vs Materiales (`reconciliacion-horas-materiales.md` — GS-009/GS-010 / DEC-013)
- **Mecanismo:** Backend relacional cruza `material_consumption` con `time_entries` mediante la llave relacional `Quincena + Barco + OT + Taller`.
- **Alerta:** Emite tarjeta `⚠️ Material sin Carga de Horas / Trabajo Reportado` si un taller retira material de pañol sin respaldo de horas o trabajo asignado.
- **Resolución 1-Clic:** Botón para re-imputar material, botón para auto-completar formulario de horas o botón para excepción justificada.

---

### 🔄 ACTUALIZADO v7 — M4 — Logística y Suministros

#### Tabla: `materials` (Catálogo Maestro de Materiales — GS-002)
- `id`: `uuid PK`
- `name` (Nombre Estandarizado): `text NOT NULL` (Nomenclatura estricta por categoría)
- `unit` (Unidad Medida): `text`
- `cost_ars` / `cost_usd`: `numeric`
- `security_pct` (% Seguridad): `numeric` (1.06 default)
- `category` (Categoría): `text` (`MATERIALES`, `CONSUMIBLES`, `ELEM_SEGURIDAD`)
- `trade` (Rubro Material): `text`
- `weight_kg` (Peso unitario Kg): `numeric`
- `location` (Ubicación Pañol): `text`
- `supplier_id` (Proveedor Habitual): `uuid FK → suppliers` (Calculado desde compras por frecuencia)

#### 🔄 ACTUALIZADO v7 — Tabla: `material_consumption` (Retiros de Pañol — GS-002)
- `id`: `uuid PK`
- `ship_id` (Barco): `uuid FK → ships`
- `work_order_id` (OT): `uuid FK → work_orders`
- `worker_id` (Operario/Taller que retira): `uuid FK → workers/workshops`
- `material_id` (Material): `uuid FK → materials`
- `work_date` (Fecha): `date`
- `quantity_used` (Cantidad Retirada): `numeric` (Devoluciones se corrigen editando este número)
- `unit_cost_usd` (Costo Unitario USD): `numeric` (Congelado al momento del retiro)
- `total_cost_usd` (Costo Total USD): `numeric`
- `weight_kg_total` (Peso Total Kg): `numeric` (`quantity_used × weight_kg`)
- `center_of_cost` (Centro de Costo): `text` (`CLIENTE` o `CONTRATISTA`)
- `cost_client_usd` (Costo Porción Cliente): `numeric` (Se suma al costo de OT)
- `cost_contractor_usd` (Costo Porción Contratista): `numeric` (Genera informe de descuento quincenal)
- `discount_pct` (% Descuento Aplicado): `numeric` (Desde perfil de workshop)
- `voucher_number` (N° Remito Pañol): `text`
- `review_status`: `text`

---

### 🆕 NUEVO v7 — M4b — Compras (`compras-planilla-registro.md` — GS-006)

> **Estado:** ✅ Escaneo Profundo Confirmado.

#### Tabla: `purchase_orders` (Registro de Compras)
- `id`: `uuid PK`
- `charge_type` (Tipo Carga): `text` (`DIRECT`, `STANDBY`, `VIA_PANOL`)
- `order_date` (Fecha Pedido): `date`
- `ship_id` (Barco): `uuid FK → ships` (Si es stock: `ASTILLERO`)
- `work_order_id` (OT): `uuid FK → work_orders` (Si es stock: `STOCK`)
- `requested_by` (Solicitante): `uuid FK → workers`
- `material_id` (Material Catálogo): `uuid FK → materials` (Nullable si es material nuevo)
- `material_name_raw` (Nombre Escrito Libre): `text` (Preservado para auditoría)
- `quantity` (Cantidad): `numeric`
- `supplier_quoted_price` (Precio Cotizado ARS): `numeric`
- `system_unit_price` (Precio Sistema ARS): `numeric` (Traído de `materials`)
- `supplier_id` (Proveedor): `uuid FK → suppliers`
- `estimated_delivery` (Fecha Entrega Estimada): `date`
- `status` (Estado Pedido): `text` (`PEDIR`, `PEDIDO`, `RECIBIDO`, `RECIB.COMP.DIRECT`, `COTIZACION`, `COTIZA.SOLICITUD`, `COTIZA.APROBADA`, `COTIZA.RECHAZADA`, `PEDIDO INCOMPLETO`, `CANCELADOS`, `SE COMPRA?`, `NO VENDEN`)
- `stock_condition` (Condición Stock): `text` (`STOCK`, `VIRTUAL`, `FALTA INFO`)
- `is_new_material` (¿Material Nuevo sin Registro?): `boolean` (Dispara alerta de alta)
- `is_reconciled` (Conciliado con Factura / Línea Morada): `boolean`
- `created_by_automation` (¿Pedido Automatizado por Sistema?): `boolean` (Distingue si fue enviado automáticamente vía WhatsApp/Email o cargado a mano)
- `reconciled_at` (Fecha Conciliación): `timestamptz`
- `fortnight_period` (Quincena): `text` (Ej: `2026-08-Q1`)

#### 🆕 NUEVO v7 — Alta de Material Nuevo (🔒 SUPERVISOR ONLY)
- Búsqueda con autocompletado disponible para todos los usuarios.
- Si el material no existe, el operario escribe el nombre libre (`is_new_material = true`).
- **Alta Formal:** Exclusiva de Supervisor. El supervisor estandariza el nombre según nomenclaturas estrictas (bulones, caños, chapas) y asigna rubro/categoría antes de ingresar a `materials`.

#### 🆕 NUEVO v7 — Tabla: `suppliers` (Catálogo Unificado de Proveedores)
- `id`: `uuid PK`
- `name` (Nombre / Razón Social): `text NOT NULL UNIQUE`
- `trade` (Rubro Principal): `text`
- `payment_method` (Manera de Pago): `text` (`CONTADO`, `CUENTA CORRIENTE`)
- `billing_timing` (Momento Facturación): `text` (`DIA`, `INICIO DE MES`, `ALEATORIO`)
- `billing_medium` (Medio Facturación): `text` (`EMAIL`, `WHATSAPP`, `EN MANO`)
- `late_billing_alert` (Alerta Facturación Tardía): `boolean`
- `enabled_purchases` / `enabled_third_party` / `enabled_hours` / `enabled_materials`: `boolean`

#### 🆕 NUEVO v7 — Tabla: `material_price_log` (Historial de Precios de Materiales)
- `id`: `uuid PK`
- `material_id`: `uuid FK → materials`
- `previous_price_ars` / `new_price_ars`: `numeric`
- `previous_price_usd` / `new_price_usd`: `numeric`
- `exchange_rate`: `numeric`
- `fortnight_period`: `text`
- `changed_by`: `uuid FK → auth.users`
- `changed_at`: `timestamptz`
- `reason`: `text`

---

### 🆕 NUEVO v7 — M4c — Control de Stock e Inventarios (`stock-planilla-registro.md` — GS-007)

> **Estado:** ✅ Escaneo Profundo Confirmado.

#### Tabla: `stock_adjustments` (Ajustes de Inventario — Reemplaza hoja ENTRADAS)
- `id`: `uuid PK`
- `date` (Fecha Ajuste): `date`
- `material_id` (Material): `uuid FK → materials`
- `quantity` (Cantidad Ajustada): `numeric` (Positivo o negativo)
- `reason_type` (Motivo Estándar): `text` (`AUDIT_CORRECTION`, `DAMAGE`, `INITIALIZATION`, `OTHER`)
- `material_condition` (Estado del Material): `text` (`DISPONIBLE`, `EN CUARENTENA`, `OBSOLETO`, `DAÑADO`)
- `unit_cost_at_adjustment` (Precio Unitario Al Momento): `numeric` (Para valorización de mermas)
- `notes` (Observaciones): `text`
- `created_by`: `uuid FK → auth.users`

#### Tabla: `stock_audits` (Bitácora de Controles Físicos — GS-007)
- `id`: `uuid PK`
- `date` (Fecha Auditoría): `date`
- `material_id` (Material): `uuid FK → materials`
- `system_quantity` (Stock Teórico Sistema): `numeric`
- `counted_quantity` (Stock Físico Contado): `numeric`
- `calculated_delta` (Diferencia Calculada): `numeric` (`counted_quantity - system_quantity`)
- `status` (Resultado Auditoría): `text` (`OK`, `DISCREPANCY`)
- `adjustment_id` (Ajuste Compensatorio 1-Clic): `uuid FK → stock_adjustments` (Vínculo al ajuste que resolvió la diferencia)
- `audited_by`: `uuid FK → auth.users`

#### 🆕 NUEVO v7 — Auditoría por Lotes y Ajuste 1-Clic
- **Interfaz por Rubro:** El pañolero/supervisor selecciona un Rubro (Ej: Planchuelas). La UI carga todos los ítems del rubro con su stock teórico.
- **Cálculo de Delta Automático:** Al ingresar el contado físico, calcula la diferencia al instante.
- **Ajuste 1-Clic:** Botón para generar el `stock_adjustment` compensatorio e ingresar el valorizado de la diferencia en un solo paso.

---

### M5 — Comercial

- Tablas: `quotes` (Presupuestos), `invoices` (Facturas).
- Pendiente de escaneo profundo y definición de planillas comerciales en detalle.

---

### 🔄 ACTUALIZADO v7 — M6 — Cierre, Tarifarios y Auditoría (`resumen-gerencial.md` — GS-004 / `tarifario_puesta_en_seco_alfa.md`)

#### Tabla: `fortnight_settings` (Parámetros Quincenales del Supervisor)
- `id`: `uuid PK`
- `fortnight_period` (Quincena): `text` (`YYYY-MM-Q1` o `YYYY-MM-Q2`)
- `exchange_rate_usd` (Tipo Cambio Oficial USD/ARS): `numeric` (Fijado para congelar costos de la quincena)
- `security_factor_default` (Factor Seguridad Default): `numeric` (1.06)
- `set_by`: `uuid FK → auth.users`
- `set_at`: `timestamptz`

#### 🆕 NUEVO v7 — Tarifario Alfa de Puesta en Seco (`tarifario_puesta_en_seco_alfa.md`)
- Tabla de referencia para tarifar maniobras de subida/bajada y estadía en varadero por eslora/categoría de barco.

#### Tabla: `audit_logs` (Historial Inmutable)
- `id`: `uuid PK`
- `table_name`: `text`
- `record_id`: `uuid`
- `action`: `text` (`INSERT`, `UPDATE`, `SOFT_DELETE`, `SPLIT`)
- `user_id`: `uuid`
- `before_values`: `jsonb`
- `after_values`: `jsonb`
- `id_origen_cambio`: `uuid FK → review_tickets` (Vínculo al ticket de revisión si el cambio vino de una auditoría)
- `created_at`: `timestamptz`

---

## 4. Resumen de Tablas del Sistema ERP (v7)

| # | Tabla Supabase | Módulo | Planilla Legacy | Estado Mapeo |
|---|---|---|---|---|
| 1 | `owners` | M1 | GS-001 a GS-005 | ✅ Confirmado |
| 2 | `ships` | M1 | GS-001 a GS-005 | ✅ Confirmado |
| 3 | `contacts` | M1 | Nueva | ✅ Confirmado |
| 4 | `workers` | M2 | GS-008 B.D.NewSystemm | ✅ Escaneo Profundo |
| 5 | `workshops` | M2 | GS-008 B.D.NewSystemm | ✅ Escaneo Profundo |
| 6 | `worker_categories` | M2 | GS-008 B.D.NewSystemm | ✅ Escaneo Profundo |
| 7 | `rate_cards` | M2 | GS-008 B.D.NewSystemm | ✅ Escaneo Profundo |
| 8 | `work_orders` | M3 | GS-003 Lista Trabajos | ✅ Confirmado |
| 9 | `work_order_workshops` | M3 | Nueva (Relación Múltiple) | ✅ Confirmado |
| 10 | `time_entries` | M3 | GS-001 Horas | ✅ Escaneo Profundo |
| 11 | `third_party_works` | M3 | GS-005 Terceros | ✅ Escaneo Profundo |
| 12 | `review_tickets` | M3/Transversal | `revision_planillas.md` | 🆕 NUEVO v7 |
| 13 | `work_order_costs` | M3 | GS-004 Resumen Gerencial | ✅ Escaneo Profundo |
| 14 | `materials` | M4 | GS-002 B.D Materiales | ✅ Escaneo Profundo |
| 15 | `material_consumption` | M4 | GS-002 Materiales | ✅ Escaneo Profundo |
| 16 | `purchase_orders` | M4b Compras | GS-006 Compras | 🆕 NUEVO v7 |
| 17 | `suppliers` | M4b Compras | GS-006 Proveedores | 🆕 NUEVO v7 |
| 18 | `material_price_log` | M4b Compras | GS-006 Historial Precios | 🆕 NUEVO v7 |
| 19 | `stock_adjustments` | M4c Stock | GS-007 Entradas | 🆕 NUEVO v7 |
| 20 | `stock_audits` | M4c Stock | GS-007 Reg. Control Stock | 🆕 NUEVO v7 |
| 21 | `fortnight_settings` | M6 Cierre | GS-008 / GS-004 | 🆕 NUEVO v7 |
| 22 | `audit_logs` | M6 Cierre | Nueva (Inmutable) | ✅ Confirmado |

---

## 5. Tareas Pendientes y Roadmap Inmediato

1. **Definición de templates PDF:** Remito de trabajo finalizado para OT (`pending_remito`) y Sub-reporte de Descuentos a Contratistas (Consumibles y Seguridad).
2. **Lógica de Archivado Google Drive:** Convención de nombres y permisos para `attachment_url` en Terceros y Compras.
3. **Escaneo M5 Comercial:** Mapear planillas de presupuestos y facturación oficiales.
