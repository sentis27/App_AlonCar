# 🛡️ ESTÁNDAR 07: TRAZABILIDAD UNIFICADA, LIBRO DE AUDITORÍA Y MÉTRICAS DE USO (`audit_logs`)

> **Propósito:**  
> Establecer el mecanismo único, obligatorio y transversal de registro de cambios para todas las pantallas y submódulos de tipo `CARGA_EDICION` (Gallo), así como su explotación analítica en las herramientas de tipo `METRICAS_ANALISIS` (Gallina) y el futuro Asistente de IA integrado en la App.

---

## 1. Regla de Oro de Vinculación Obligatoria

Toda planilla, pestaña o formulario donde el usuario cargue, edite, pegue o elimine datos (**ver Padrón 2.A en `00_INDICE_DE_MODULOS_Y_CLASIFICACION.md`**) **DEBE estar vinculado a `app/src/lib/auditService.js`**.

Ninguna mutación de datos hacia Supabase puede ejecutarse de forma "silenciosa" sin dejar su huella estandarizada en la tabla `audit_logs`.

---

## 2. Contrato de Datos en Base de Datos (`public.audit_logs`)

La tabla `audit_logs` almacena cada evento transaccional con la siguiente estructura:

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `uuid` | Identificador único del evento de auditoría. |
| `action` | `text` | Tipo de operación: `CELL_EDIT`, `BATCH_PASTE`, `ROW_INSERT`, `ROW_DELETE`, `ROW_DUPLICATE`, `MODAL_SAVE`, `STATUS_CHANGE`. |
| `entity_type` | `text` | Nombre canónico de la tabla/entidad afectada (`workers`, `rate_cards`, `work_orders`, `work_order_tasks`, `daily_labor_logs`, `purchase_orders`, `suppliers`, `inventory`, `materials`, `gas_cylinders`, `ppe_deliveries`, `ships`, `ship_stays`, `owners`, `third_party_services`, `workshops`, `system_settings`, `user_roles`, `macro_variables`). |
| `entity_id` | `text` | ID primario (`uuid` o código) del registro afectado. Permite consultar el historial exacto de una fila con clic derecho. |
| `entity_name` | `text` | Etiqueta legible para humanos (ej. `"Caballero, Daniel Emanuel"`, `"OT #104 - MIS SUEÑOS"`, `"Chapa Naval 1/4"`). |
| `details` | `jsonb` | Objeto estructurado con los metadatos del cambio (ver detalle abajo). |
| `performed_by` | `text` | Nombre completo o correo electrónico del usuario autenticado que ejecutó la acción. |
| `created_at` | `timestamptz` | Fecha y hora exacta del servidor. |

### Estructura Estándar del JSON `details`:
```json
{
  "sheet_name": "Personal · Nómina de Operarios",
  "module_route": "/personal",
  "change_origin": "INLINE_CELL",
  "field": "category",
  "field_label": "Categoría",
  "old_value": "MEDIO OFICIAL",
  "new_value": "OFICIAL",
  "changes": {
    "category": { "from": "MEDIO OFICIAL", "to": "OFICIAL" }
  }
}
```

---

## 3. Blindaje Anti-Corrupción de Datos (`[object Object]` Guard)

Para evitar que eventos nativos del DOM/React (`FocusEvent`, `SyntheticBaseEvent`) se filtren por error hacia la base de datos al perder el foco (`onBlur`):
1. Todo manejador `onBlur` que invoque una función con parámetros opcionales debe declararse como `onBlur={() => commitFn()}`.
2. Tanto la función de guardado local como `auditService.js` sanitizan cualquier valor escalar rechazando objetos de evento (`if (val && typeof val === 'object' && ('nativeEvent' in val || 'target' in val)) return`).

---

## 4. Canales de Visualización (`METRICAS_ANALISIS` — Gallina)

1. **In-Situ por Fila/Celda (`GridContextMenu.jsx`):**
   - Al hacer clic derecho sobre cualquier fila o celda en cualquier planilla `CARGA_EDICION` y elegir **"Ver historial de cambios"**, se consulta `audit_logs` filtrando por `entity_id` y se despliega la línea de tiempo con fecha, autor, campo modificado, valor anterior y valor nuevo.
2. **Hoja Maestra Global en Panel de Administrador (`AdminAuditLedger.jsx` en `/admin`):**
   - Pestaña dedicada **"Libro de Auditoría & Trazabilidad"**.
   - **Métricas de Uso y Calidad de Carga:**
     - Total de operaciones registradas y actividad del día/quincena.
     - Ranking de planillas con mayor volumen de carga y edición.
     - Ranking de actividad por usuario.
     - Detección de correcciones recurrentes (campos que se re-editan múltiples veces sobre el mismo registro).
   - **Filtros Combinables:** Por módulo/planilla (`entity_type`), por usuario (`performed_by`), por tipo de acción (`action`), por rango de fechas y buscador omnicanal.
   - **Acciones Directas:** Navegación rápida hacia la planilla de origen y exportación completa a Excel/CSV.
