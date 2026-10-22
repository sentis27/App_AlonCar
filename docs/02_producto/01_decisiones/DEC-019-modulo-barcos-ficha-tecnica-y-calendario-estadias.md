# DEC-019 — Módulo M1: Barcos, Ficha Técnica Naval Dinámica y Calendario de Movimientos & Estadías

> **Estado:** Implementado / Aprobado
> **Fase:** 4 (M1 - Activos Navales & Estadías)
> **Fecha:** 2026-10-22
> **Módulos Afectados:** M1 (`/barcos`), M3 (`/horas`), Base de Datos (Migración 0018)

---

## 1. Contexto y Origen de la Decisión

El Módulo M1 requería pasar de un estado provisional (*placeholder*) a un módulo operativo completo que resolviera tres necesidades centrales del astillero Alon Car:
1. Reemplazar la planilla legacy `CALENDARIO DE ESTADIA BARCOS` mediante un submódulo de **Calendario de Movimientos & Estadías**, calculando días corridos acumulativos.
2. Implementar la **Ficha Técnica Naval Dinámica** (según el documento `docs/modulos/M1_barcos/ficha_tecnica.md`), permitiendo relevar tanques, válvulas y pocetes sin saturar de columnas la base de datos.
3. Centralizar el directorio de **Empresas Propietarias y Armadores** con nombre de armador, teléfonos y doble correo electrónico (principal y facturación).
4. Reemplazar la acción de crear barco/OT a ciegas en Carga de Horas por un mecanismo formal de **"Solicitar Apertura"** para alertar a la administración de nuevos trabajos sin centro de costos abierto.

---

## 2. Decisiones de Negocio y Reglas Técnicas

### 2.1 Calendario de Movimientos & Estadías
- **Locaciones Oficiales:** Dropdown estandarizado según la planilla histórica:
  - `VARADERO ALON CAR` (Puesta en seco)
  - `MUELLE ALON CAR` (A flote con servicios)
  - `PUERTO 1RA ALDANA` a `PUERTO 7MA ALDANA` (Muelles y apostaderos externos)
- **Fechas y Días Corridos:**
  - `start_date` (Comienzo): Carga manual de fecha de ingreso.
  - `end_date` (Fin): Si el barco sigue en la locación, se mantiene abierto y la UI calcula los días acumulados contra la fecha actual (`=HOY()`). Al retirarse, se asienta la fecha de cierre manual.
  - **Fórmula de Días:** `Fin - Comienzo + 1` días corridos inclusivos (`calculateStayDays`).
- **Electricidad:** Omitida por el momento en esta planilla por decisión de negocio; su cálculo se reservará para el Anexo de Factura (Módulo 5).

### 2.2 Directorio de Propietarios, Armadores y Contactos
- Tabla relacional `public.owners`:
  - Razón Social de la empresa.
  - Nombre del Armador.
  - Teléfono de contacto directo del Armador.
  - `email_principal`: Correo de contacto operativo.
  - `email_secundario`: Correo adicional (administración / facturación).
  - CUIT y notas.
- Tabla `public.contacts` para personal a bordo (Capitán, Patrón, Jefe de Máquinas, etc.).

### 2.3 Ficha Técnica Naval Dinámica
- **Datos Core (Numéricos/Fijos):** Eslora (mts), Manga (mts), Puntal (mts), Superficie de Casco ($m^2$).
- **Componentes en JSONB (`technical_specs`):**
  1. `tanques_combustible`: Cantidad + observaciones si cantidad > 0.
  2. `tanques_agua`: Cantidad + observaciones si cantidad > 0.
  3. `valvulas_casco_1_a_2_5`: Cantidad + observaciones si cantidad > 0.
  4. `valvulas_casco_3_a_6`: Cantidad + observaciones si cantidad > 0.
  5. `valvulas_intermediarias`: Cantidad + observaciones si cantidad > 0.
  6. `pocetes_achique`: Cantidad + observaciones si cantidad > 0.
  - El Jefe de Obra solo ve el campo de texto amplio si indica que la cantidad es mayor a 0.

### 2.4 Matriz de Roles y Flujo de "Solicitud de Carga"
- **Jorge Sentis (Administrador):** Da de alta el buque y presiona **"📢 Solicitar Info"**, asignando si la solicitud es para María José, para Jefes de Obra, o para ambos.
- **María José (Comercial / Administración):** Completa los datos de Armador, teléfonos, emails y el Calendario de Movimientos.
- **Jefes de Obra (Técnico / Operaciones):** Completan las medidas core y la Ficha Técnica Dinámica a bordo.
- **Badge de Alerta:** En el listado de buques, se destaca con badge ámbar los buques con información pendiente de carga.

### 2.6 Mejoras Operativas de Usabilidad (Feedback de Producción)
- **Vista Filas / Tabla como Predeterminada:** Siguiendo el diseño de Órdenes de Trabajo, se incorporó una tabla compacta con renglones detallados (Buque, Tipo, Locación, Medidas, OTs Activas, Armador, Solicitud y Acciones), manteniendo la opción de alternar a Vista Fichas/Tarjetas.
- **KPIs Interactivos con Filtro Directo:** Al hacer clic sobre cualquier casilla de KPI (`Total Buques`, `En Varadero`, `En Muelle`, `Puertos Aldana`, `Solicitudes`), el sistema aplica inmediatamente el filtro correspondiente en la tabla inferior (con opción de deseleccionar al volver a cliquear).
- **Solicitud con Cuadro de Instrucciones Claras (`info_request_notes`):** La ventana de solicitud de información ahora incluye un cuadro de texto amplio donde Jorge Sentis (Admin) escribe instrucciones detalladas para el Jefe de Obra o María José (ej. *"Relevar espesores de chapa del fondo y verificar las 4 válvulas de aspiración"*). Esta nota se muestra destacada en la fila y en la Ficha 360°.
- **Tipos de Embarcación Adaptables:** Se eliminó la opción obsoleta "Arenero" y se incorporó "Desguace", sumando una opción abierta de *"Otro tipo personalizado..."* para escribir libremente cualquier otra categoría naval.
- **Cálculo Preciso de OTs Activas:** Se vinculó la carga de `work_items` junto a `work_orders`, reconociendo como activas las órdenes con trabajos en ejecución (ej. NONO PASCUAL con 2 OTs en curso).
- **Banner Contextual de Roles:** Al alternar el selector de rol (`Admin`, `María José`, `Jefe de Obra`), un banner dinámico explica qué responsabilidades corresponden a cada perfil y ofrece botones de filtrado rápido directo.

---

## 3. Base de Datos (Migraciones 0018 y 0019)
- **Migración 0018 (`0018_ships_owners_and_stays.sql`):**
  - Creación de `public.owners`, `public.contacts`, `public.ship_stays`.
  - Ampliación de columnas en `public.ships` (`owner_id`, `eslora_mts`, `manga_mts`, `technical_specs`, `current_location`, `info_request_status`, etc.).
  - Políticas RLS configuradas para acceso seguro.
- **Migración 0019 (`0019_add_ship_info_request_notes.sql`):**
  - Incorporación del campo `info_request_notes TEXT` a `public.ships` para almacenar las instrucciones personalizadas de la solicitud de carga.

