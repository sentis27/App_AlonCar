---
id: ERR-007
tipo: error
fase: 3
estado: borrador
fecha: 2026-11-15
modulo: /horas
---
# Disparidad de políticas RLS y feedback off-screen bloquearon guardado de horas en `/horas`

> **Lectura rápida (15 seg):** Si un formulario parece no hacer nada al confirmar, **verificar si la tabla tiene RLS pública para sesión local (Ingreso Directo / anon)** y si el mensaje de error se está renderizando fuera del viewport del botón.

## Qué pasó / Dónde / Por qué
- **Error (qué):** Al presionar el botón "Confirmar Registro Grupal" en `/horas`, el sistema no guardaba las imputaciones ni mostraba feedback al usuario, pareciendo que la acción quedaba inerte.
- **Dónde ocurrió:** 
  1. Base de datos Supabase: tabla `public.labor_logs` (y `public.work_orders`).
  2. UI: `app/src/pages/LaborLogs.jsx` y `app/src/components/labor/LaborCrewGridSection.jsx`.
  3. Estado: `app/src/hooks/useLaborCargaCrewState.js` (`workType` inicializado en `'MONTAJE'`).
- **Por qué ocurrió:**
  1. **Disparidad de RLS:** La app admite sesión operativa local (Ingreso Directo vía `anon`). Mientras tablas operativas como `materials`, `workers`, `ships`, `inventory_transactions` tenían política pública (`FOR ALL USING (true)`), `labor_logs` solo permitía operaciones a `{authenticated}`, arrojando `POST 401: new row violates row-level security policy for table "labor_logs"`.
  2. **Feedback visual fuera del viewport (SKL-012):** `LaborLogs.jsx` renderizaba `{statusMessage && ...}` en la parte superior (arriba del radar de 5 KPIs), a más de 600px por encima de la posición del usuario que está al final del formulario scrolleado.
  3. **Incongruencia de opciones:** `workType` se iniciaba en `'MONTAJE'`, opción inexistente en el selector canónico de modalidad (`'HORA'`, `'PRESUPUESTO'`, `'CONTROL'`).

## Solución aplicada
- **Migración 0043 (`supabase/migrations/0043_align_labor_logs_and_work_orders_rls.sql`):** Alineó RLS en `public.labor_logs` y `public.work_orders` creando política `Public access` `FOR ALL USING (true) WITH CHECK (true)` y `GRANT ALL TO anon, authenticated, service_role`.
- **Feedback in-situ (`LaborCrewGridSection.jsx` y `LaborCargaPanel.jsx`):** Conectó `statusMessage` y `onClearStatusMessage` directamente en el pie de la grilla de cuadrilla, desplegando banners de éxito o error inmediatamente encima del botón de confirmación.
- **Normalización de estado (`useLaborCargaCrewState.js`):** Valor por defecto de `workType` corregido a `'HORA'`.

## Regla anti-regresión (Cómo detectarlo / Evitar loop)
1. **Regla de RLS unificado para tablas operativas:** Toda tabla editable desde la interfaz operativa (`CARGA_EDICION`) debe contar con política permisiva para `{public}` / `anon` mientras conviva el modo de sesión local con Supabase Auth.
2. **Ergonomía de submit (SKL-012):** Todo botón de acción mayor o confirmación en formularios extensos debe tener un contenedor de feedback inmediato (`aria-live="polite"`) contiguo al botón, sin depender exclusivamente de alertas en el tope de la página.
3. **Prueba de persistencia en runtime Node (SKL-007):** Toda validación de persistencia debe ejecutar un ciclo real de inserción y lectura con el cliente `anon` (`supabase.from(tabla).insert(...)`) para confirmar ausencia de `PGRST204` / `401 RLS`.
