# DEC-020 — Terminales de Trabajo, Documentación Técnica Naval (Anguilera/Pintado) y Gestión de Armadores

> **Estado:** Implementado / Aprobado
> **Fase:** 4 (M1 - Activos Navales, Ficha Técnica & Terminales)
> **Fecha:** 2026-10-22
> **Módulos Afectados:** M1 (`/barcos`), Supabase Storage (`ship-documents`), Base de Datos (Migración 0020)

---

## 1. Contexto y Objetivos

A partir de las pruebas operativas en astillero, se definieron ajustes esenciales en usabilidad, gestión documental naval y la arquitectura de roles:
1. **Limpieza de Nomenclatura:** Erradicar redundancias como `"ALON CAR"`, `"ASTILLERO"` o `"USO INTERNO"` de locaciones y etiquetas. La locación operativa dentro de planta es simplemente `VARADERO` (puesta en seco) o `MUELLE` (a flote), y los puertos externos `PUERTO 1RA ALDANA`, etc.
2. **Eliminación Definitiva de Armadores (Hard Delete) & Alerta de Buques Huérfanos:** A diferencia de los buques y OTs (que tienen baja lógica inviolable), las empresas armadoras admiten borrado físico si se cargaron por error o cesaron. Sin embargo, para preservar la integridad operativa, todo borrado queda registrado en la tabla `public.audit_logs`, y los buques que estaban asociados a dicha empresa pasan automáticamente a estado de **Buque Huérfano** con alerta prioritaria para María José.
3. **Vistas Duales Universales:** Selector `[☷ Vista Filas]` / `[⊞ Vista Fichas]` disponible en las tres pestañas del módulo (Buques, Calendario de Estadías, y Armadores).
4. **Documentación Técnica Naval para el Jefe de Obra:** Incorporación de slots de carga de archivos en Supabase Storage para:
   - **Plano de Diseño de Anguilera:** Archivos constructivos de puesta en seco (`.dwg`, `.dxf`, `.pdf`, CAD).
   - **Informe de Pintado de Casco:** Archivos técnicos de esquema de pintado y preparación de superficie (`.pdf`).
5. **Filosofía de "Terminales de Trabajo por Puesto" (Navaja Suiza):** Establecer que cada puesto (Jefe de Obra, María José, Jorge Sentis/Admin) cuente con una estación de trabajo a medida, con claridad absoluta sobre **qué debe completar** y **qué información puede consumir**.

---

## 2. Reglas de Negocio y Diseño Funcional

### 2.1 Estandarización de Locaciones
- **Locaciones oficiales:**
  - `VARADERO` (Varada en seco en anguilera).
  - `MUELLE` (Amarre a flote con servicios).
  - `PUERTO 1RA ALDANA` a `PUERTO 7MA ALDANA` (Apostaderos externos).
- Queda prohibido añadir sufijos corporativos redundantes en interfaces operativas.

### 2.2 Eliminación de Armadores, Hoja de Auditoría y Buques Huérfanos
- **Borrado Definitivo:** Se permite eliminar un registro de `public.owners`.
- **Registro en Hoja de Auditoría:** Al eliminar, se genera un registro en `public.audit_logs` con `action = 'DELETE_OWNER'`, guardando snapshot de datos de la empresa (CUIT, armador, teléfonos, emails, usuario ejecutor y buques afectados).
- **Alerta de Buque Huérfano para María José:**
  - Si el armador eliminado tenía buques asignados, el sistema desvincula `owner_id = NULL` y marca en `public.ships`:
    - `orphan_owner_alert = true`
    - `orphan_owner_previous_name = [Nombre del armador eliminado]`
  - En la interfaz de María José se muestra un banner de advertencia con los buques huérfanos.
  - En cada buque huérfano se ofrecen dos opciones:
    1. **`🏢 Asignar Armador`**: Permite seleccionar otra empresa activa del padrón, extinguiendo la alerta.
    2. **`🔕 Apagar Alerta`**: Permite silenciar la alerta si el buque no tiene destino comercial conocido o permanece inactivo temporalmente.

### 2.3 Terminal Técnica del Jefe de Obra & Documentos Navales
- **Bucket de Almacenamiento:** `ship-documents` en Supabase Storage.
- **Slots Documentales Especiales:**
  - `plan_anguilera_url`: Archivo de diseño de anguilera (`.dwg`, `.dxf`, `.pdf`).
  - `informe_pintado_url`: Certificado o informe de esquema de pintado (`.pdf`).
- **Historial Relacional:** Cada subida se asienta además en la tabla `public.ship_documents` con metadatos (nombre de archivo, peso en bytes, fecha y usuario técnico).
- Acciones disponibles: Ver / Descargar, Reemplazar y Quitar.

### 2.4 Matriz de Terminales de Trabajo (Navaja Suiza)
| Terminal | Qué debe completar | Qué consume / consulta |
| :--- | :--- | :--- |
| **🛠️ Jefe de Obra** *(Técnica / Operativa)* | • Medidas reales de casco (Eslora, Manga, Puntal, Sup.).<br>• Inventario a bordo (Válvulas 1" a 2½", 3" a 6", intermediarias, tanques, pocetes).<br>• Subida de Plano de Anguilera (`.dwg`/`.pdf`).<br>• Subida de Informe de Pintado (`.pdf`). | • Planos de varada previos.<br>• Historial de OTs en ejecución y trabajos asignados.<br>• Ficha técnica consolidada. |
| **📋 María José** *(Comercial / Admin)* | • Directorio de Armadores (Razón Social, CUIT, armador, teléfono, emails dobles).<br>• Calendario de Movimientos (Ingreso/Salida en Varadero, Muelle, Aldana).<br>• Resolución de Buques Huérfanos (asignación o apagado). | • Días corridos de estadía (=HOY).<br>• Padrón de buques en planta.<br>• Contactos comerciales directos. |
| **👑 Admin (Jorge Sentis)** *(Gobernanza)* | • Alta de buques y tipos personalizados.<br>• Solicitudes de información con instrucciones escritas.<br>• Bajas lógicas de buques.<br>• Eliminación auditada de empresas armadoras. | • Hoja de Auditoría (`audit_logs`).<br>• KPIs de ocupación de planta.<br>• Tablero de gobernanza IA. |

---

## 3. Base de Datos (Migración 0020)
- Normalización masiva de locaciones: `VARADERO ALON CAR` $\to$ `VARADERO`, `MUELLE ALON CAR` $\to$ `MUELLE`.
- Columnas de buque huérfano: `orphan_owner_alert`, `orphan_owner_previous_name`.
- Columnas técnicas: `plan_anguilera_url`, `plan_anguilera_name`, `informe_pintado_url`, `informe_pintado_name`.
- Creación de tabla `public.audit_logs`.
- Creación de tabla `public.ship_documents`.
- Configuración de bucket `ship-documents` con políticas RLS de lectura y escritura.
