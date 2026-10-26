---
version: 1.0
last_updated: 2026-10-26
status: DOCUMENTO_VIVO_ACTIVO
evolution_api_status: CONECTADO_LISTO
---

# Matriz de Responsabilidad de Datos y Motor de Alertas Proactivas (Alon Car ERP)

> **Regla de Operación:** Este es un **documento vivo**. En cada sesión de trabajo, al solicitar la actualización de repositorios o al incorporar nuevas funcionalidades en la aplicación, se debe revisar la conversación y actualizar este archivo con las nuevas reglas, roles y responsables definidos, recordando en cada turno los datos y disparadores pendientes.

---

## 1. Objetivo y Filosofía del Sistema

Evitar que el cumplimiento operativo dependa de la memoria de las personas o de que un supervisor tenga que estar persiguiendo a otros para que carguen sus datos.
Cada dato sensible, archivo o comprobante del sistema tiene:
1. Un **Rol y Persona Responsable** asignada.
2. Un **Evento Gatillo (Trigger)** que activa la obligación automáticamente.
3. Un **Barco de Referencia (`ship_id`)**, dado que cada alerta e incumplimiento vive asociado a una embarcación específica.
4. Un circuito de avisos por **Alerta In-App en su Terminal** y por **WhatsApp (Evolution API)** con horario, frecuencia y un **contador de intentos** hasta que el dato es efectivamente completado.

---

## 2. Atributos Fundamentales de Cada Requisito

Cada registro en el Catálogo de Requisitos (`data_requirements`) y en la cola de Alertas (`compliance_alerts`) contempla:

| Atributo | Campo en BD | Descripción |
| :--- | :--- | :--- |
| **Módulo** | `module` | Módulo del ERP (`barcos`, `terceros`, `ots`, `horas`, `estadias`, `panol`). |
| **Nombre Requisito** | `name` | Título claro de la obligación operativa. |
| **Campo Clave** | `field_key` | Columna o archivo exacto en BD (`plan_anguilera_url`, `owner_id`, `invoice_number`). |
| **Disparador (Trigger)** | `trigger_event` | Evento que dispara la exigencia (`ENTRADA_A_VARADERO`, `ALTA_BUQUE`, `FIN_DE_VARADA`, etc.). |
| **Rol Responsable** | `responsible_role` | Perfil organizacional obligado (`jefe_obra`, `maria_jose`, `admin`, `panol`). |
| **Persona Responsable** | `responsible_worker_id` | ID del operario / técnico específico en tabla `workers`. |
| **Teléfono WhatsApp** | `recipient_phone` | Número móvil para el envío automatizado mediante Evolution API. |
| **Horario de Aviso** | `notice_time` | Hora programada del día para despachar el mensaje (ej: `09:00:00`). |
| **Frecuencia de Aviso** | `notice_frequency` | Cadencia de reintentos (`DIARIO`, `CADA_48HS`, `LUNES_Y_JUEVES`, `SEMANAL`). |
| **Contador de Intentos** | `notices_sent_count` | Contador incremental de avisos enviados sin resolver. |
| **Buque Asociado** | `ship_id` | Barco vinculado al requerimiento. |

---

## 3. Catálogo Actual de Reglas y Requisitos Registrados

### 🚢 Módulo 1: Barcos y Ficha Técnica Naval

#### Regla B-01: Plano de Diseño de Anguilera en Varadero
* **Código:** `REQ_BARCO_ANGUILERA_VARADERO`
* **Módulo:** `barcos`
* **Campo Clave:** `ships.plan_anguilera_url` (archivo `.pdf` o `.dwg`)
* **Trigger:** Buque cambia o se carga con locación en `VARADERO` (en calendario o ficha) y `plan_anguilera_url IS NULL`.
* **Rol Responsable:** `jefe_obra`
* **Persona Responsable:** Jefe de Obra asignado al buque (ej: Ale Camadelli / Pablo N. / Martín Obregozo).
* **Parámetros de Alerta:**
  * Horario de aviso: `09:00 hs`
  * Frecuencia: `DIARIO`
  * Límite de intentos: `4 intentos` (luego escala a Dirección / Jorge Sentis).
* **Mensaje Tipo WhatsApp:**
  > *"Astillero Alon Car: Hola [Nombre], el buque [Nombre Barco] se encuentra en VARADERO pero aún no cuenta con el Plano de Diseño de Anguilera cargado. Por favor, suba el archivo CAD/PDF desde su terminal de Jefe de Obra."*

#### Regla B-02: Informe Técnico de Pintado de Casco y Espesores
* **Código:** `REQ_BARCO_INFORME_PINTURA`
* **Módulo:** `barcos`
* **Campo Clave:** `ships.informe_pintado_url` (archivo `.pdf`)
* **Trigger:** Salida de Varadero / Finalización de estadía de carenado y `informe_pintado_url IS NULL`.
* **Rol Responsable:** `jefe_obra`
* **Parámetros de Alerta:**
  * Horario: `09:00 hs` | Frecuencia: `DIARIO` | Límite: `3 intentos`.

#### Regla B-03: Datos de Contacto y Armador del Buque
* **Código:** `REQ_BARCO_CONTACTO_ARMADOR`
* **Módulo:** `barcos`
* **Campo Clave:** `ships.owner_id` (Armador vinculado con teléfonos y 2 mails de contacto)
* **Trigger:** Alta de un nuevo buque en el sistema sin empresa armadora asignada (`owner_id IS NULL` o `orphan_owner_alert = true`).
* **Rol Responsable:** `maria_jose`
* **Persona Responsable:** María José
* **Parámetros de Alerta:**
  * Horario: `10:00 hs` | Frecuencia: `CADA_48HS` | Límite: `5 intentos`.

---

### 🔧 Módulo 2: Terceros y Contratistas Externos (GS-005)

#### Regla T-01: Reclamo de Factura Fiscal para Remitos de Taller
* **Código:** `REQ_TERCEROS_FACTURA_RMO`
* **Módulo:** `terceros`
* **Campo Clave:** `third_party_services.invoice_number`
* **Trigger:** Comprobante de tipo `RMO` o `RPF` con más de 10 días de antigüedad sin haber evolucionado a `FCR` (Factura).
* **Rol Responsable:** `maria_jose`
* **Parámetros de Alerta:**
  * Horario: `11:00 hs` | Frecuencia: `LUNES_Y_JUEVES` | Límite: `6 intentos`.

#### Regla T-02: Asignación de OT a Trabajo de Terceros
* **Código:** `REQ_TERCEROS_ASIGNACION_OT`
* **Módulo:** `terceros`
* **Campo Clave:** `third_party_services.work_order_id`
* **Trigger:** Comprobante cargado sin centro de costos / Orden de Trabajo vinculada (`work_order_id IS NULL`).
* **Rol Responsable:** `admin` (Jorge Sentis)
* **Parámetros de Alerta:**
  * Horario: `09:30 hs` | Frecuencia: `DIARIO` | Límite: `3 intentos`.

---

## 4. Datos y Reglas Pendientes de Definir (Recordatorio por Sesión)

Para las próximas sesiones, conforme se sigan construyendo los módulos, se debe definir con el usuario:

- [ ] **Teléfonos WhatsApp de los Responsables:**
  * Cargar en la tabla `workers` los números de teléfono móvil de:
    * María José
    * Ale Camadelli (Jefe de Obra)
    * Pablo N. (Jefe de Obra)
    * Martín Obregozo (Jefe de Obra)
    * Hugo Obregozo (Dirección Operativa)
    * Jorge Sentis (Admin General)
- [ ] **Asignación Buque ↔ Jefe de Obra:**
  * ¿Se agrega una columna `lead_foreman_id` (Jefe de Obra a cargo) en la tabla `ships` o en cada `ship_stays` para saber exactamente a cuál de los 3 jefes de obra mandarle la alerta de anguilera de ese barco específico?
- [ ] **Módulo de OTs (Horas y Mano de Obra):**
  * ¿Qué disparador se exigirá al cerrar una OT? (ej: Conformidad técnica firmada, rendición de horas).
- [ ] **Módulo de Pañol / Materiales y Compras:**
  * ¿Qué alerta se dispara si un contratista retira materiales sin registrar horas imputadas a esa OT?
  * Responsable de compras cuando un ítem de pañol entra en stock crítico (< stock mínimo).
- [ ] **Endpoint y Credenciales de Evolution API:**
  * Registrar la URL base del servidor Evolution API y la API Key de la instancia para los envíos automatizados.

---

## 5. Estándares Mandatorios de UX/UI para Futuros Módulos (Pañol, Materiales y Compras)

Por directiva de arquitectura y experiencia de usuario establecida con el usuario en la sesión del 26-10-2026, **todos los nuevos módulos y tablas operativas del sistema (con foco primordial e inexcusable en Pañol, Materiales y Compras)** deben implementar de base los siguientes 2 componentes estándar tipo Hoja de Cálculo:

### 📊 Estándar 1: Selección Libre de Filas a tu Antojo + Barra Reactiva de Totales y Estadísticas (Tipo Sheets / Excel)
1. **Selección Flexible e Intuitiva:**
   - La tabla debe contar con una columna inicial de selección por fila (`input[type="checkbox"]`), además de un selector maestro en la cabecera para seleccionar/deseleccionar todas las filas visibles.
   - Posibilidad de seleccionar filas haciendo clic directo sobre la fila (sin que interfieran los botones de acción).
2. **Barra de Totales y Estadísticas Reactiva:**
   - Ubicada al pie de la tabla o flotante en pantalla, siempre visible o reactiva al scroll.
   - **Modo General:** Cuando no hay filas seleccionadas, calcula y resume en vivo todas las filas visibles según los filtros activos (cantidades, sumatorias de costos en AR$ y USD, promedios, etc.).
   - **Modo Selección Manual:** En cuanto el usuario marca 1 o más filas, la barra pasa inmediatamente a color de acento (`cyan`), mostrando `📌 Selección Manual: X de N filas`, recalculando en milisegundos sumas, promedios, valores totales y proveyendo un botón de `✕ Limpiar selección`.
   - **Acciones Rápidas Masivas:** Si el módulo lo requiere (aprobaciones, cambio de estados, solicitudes de compra, pase a pañol), los botones de acción en lote se integran directamente en esta barra.

### 📌 Estándar 2: Inmovilizar Títulos de Columnas (Sticky Header Tipo Excel)
1. **Visibilidad Continua al Scrollear:**
   - Ninguna planilla de la aplicación puede perder la cabecera al bajar por cientos o miles de registros.
   - El contenedor debe poseer `overflow-y-auto max-h-[calc(100vh-280px)]` (o altura calculada según la página).
   - La etiqueta `<thead>` debe llevar las clases `sticky top-0 z-20 bg-slate-950 shadow-sm backdrop-blur-md` y cada celda `<th>` debe poseer `bg-slate-950` para garantizar que el texto scrolleable pase perfectamente por debajo sin superposiciones ni transparencias anómalas.
2. **Prohibición de Desplazamiento Horizontal Innecesario:**
   - Todo el ancho de pantalla disponible debe ser aprovechado. La información principal debe permanecer siempre a la vista sin requerir scroll de costado en monitores de escritorio.

