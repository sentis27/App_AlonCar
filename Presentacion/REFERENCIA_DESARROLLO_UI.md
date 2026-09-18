# 📋 Referencia de Diseño de Interfaces — App_AlonCar
> **Propósito:** Este documento es la fuente de verdad para que la IA y los desarrolladores entiendan el objetivo funcional de cada pantalla del sistema. Cada módulo describe el estado actual (planilla legacy), los problemas reales documentados, y la mejora que la interfaz debe implementar.

---

## Cómo usar este documento
Al desarrollar cualquier interfaz del sistema, la IA o el desarrollador debe:
1. Leer la sección del módulo correspondiente en este archivo.
2. Consultar el mockup visual en `Presentacion/mockups_ui/` para ver la dirección de diseño.
3. Leer el mapeo técnico completo de la planilla legacy en `docs/planillas/` para entender la estructura de datos.

---

## Módulo: Carga de Horas (M3 — Operaciones)
- **Planilla legacy:** GS-001 (HORAS_PLANILLAS_DE_REGISTRO)
- **Mockup:** `Presentacion/mockups_ui/01_horas_carga.jpg`
- **Mapeo técnico:** `docs/planillas/horas-planillas-de-registro.md`

### Objetivo de la interfaz:
Formulario simple: BARCO, OT, OPERARIO, RUBRO (manual), HORAS.
- **Rubro manual:** El rubro NO se autocompleta. Se carga a mano porque es flexible por día (un calderero puede pintar, un pintor puede raschinear).
- **Descripción de OT visible:** Al seleccionar la OT, su descripción detallada aparece como texto de ayuda para que el operario sepa de qué trata.
- **Carga múltiple:** Botón "Agregar Operario al Mismo Trabajo" permite sumar operarios sin repetir barco/OT/rubro.
- **Replicar carga de ayer:** Botón que copia las cargas del día anterior, ya que muchos trabajos duran varios días.
- **Backend invisible:** Valor hora, conversión a USD, centro de costo se resuelven automáticamente.
- **Congelamiento quincenal:** Botón "Cerrar Quincena" para congelar precios y tipo de cambio.

---

## Módulo: Retiro de Materiales / Pañol (M4 — Logística)
- **Planilla legacy:** GS-002 (MATERIALES_PLANILLAS_REGISTRO)
- **Mockup:** `Presentacion/mockups_ui/02_materiales_panol.jpg`
- **Mapeo técnico:** `docs/planillas/materiales-planillas-registro.md`

### Objetivo de la interfaz:
Formulario simplificado: BARCO, OT, MATERIAL (autocompletado + imagen), CANTIDAD.
- **Autocompletado con imagen:** Al buscar el material, se muestra foto de referencia para validar visualmente.
- **Stock visible:** Badge con stock disponible en tiempo real.
- **Centro de costo automático:** La regla de "quién paga" (CLIENTE/CONTRATISTA) se resuelve con porcentajes parametrizables.
- **Informe quincenal automático:** 1 clic para generar informe de consumibles por contratista en PDF, con envío por WhatsApp o email.

---

## Módulo: Compras (M4b — Logística)
- **Planilla legacy:** GS-006 (COMPRAS_PLANILLAS_REGISTRO)
- **Mockup:** `Presentacion/mockups_ui/03_compras.jpg`
- **Mapeo técnico:** `docs/planillas/compras-planilla-registro.md`

### Objetivo de la interfaz:
Dashboard de órdenes de compra con flujo de estados visual.
- **Alta de materiales nuevos:** Autocompletado + formulario formal de alta con nomenclatura estandarizada (solo SUPERVISOR).
- **Comparación de precios:** Indicador visual automático (⬆️ / ⬇️ %) entre precio proveedor y precio sistema.
- **Estadística de proveedores on-demand:** Botón que muestra distribución histórica de compras por proveedor.
- **Conciliación de facturas:** Checkpoint "Conciliar hasta aquí" reemplaza la fila morada.

---

## Módulo: Control de Stock (M4c — Logística)
- **Planilla legacy:** GS-007 (CONTROL_DE_STOCK)
- **Mockup:** `Presentacion/mockups_ui/04_stock_auditoria.jpg`
- **Mapeo técnico:** `docs/planillas/stock-planilla-registro.md`

### Objetivo de la interfaz:
Auditoría en lote por rubro con ajuste en 1 clic.
- **Selección por rubro:** Seleccionar "Planchuelas y Caños" → el sistema trae todos los ítems con stock teórico.
- **Campo editable:** Cargar cantidad real contada → diferencia se calcula automáticamente.
- **Ajuste en 1 clic:** Botón AJUSTAR aplica la compensación sin ir a otra pestaña.
- **Valorización:** Card con valor total del inventario en USD.

---

## Módulo: Terceros (M3 — Operaciones)
- **Planilla legacy:** GS-005 (TERCEROS_PLANILLA_COSTOS)
- **Mockup:** `Presentacion/mockups_ui/05_terceros.jpg`
- **Mapeo técnico:** `docs/planillas/terceros-planilla.md`

### Objetivo de la interfaz:
Formulario de carga con verificación cruzada de remitos.
- **Rubro autocompletado:** Al seleccionar el proveedor, el rubro se completa automáticamente desde la BD de proveedores.
- **Tarjeta de verificación de remito:** Al cargar el Nº Remito Aloncar, aparece una tarjeta flotante con los materiales exactos retirados del pañol bajo ese remito.
- **Generación automática de PRC $0:** Al crear un trabajo de terceros, se genera el registro PRC con datos heredados.
- **Tipos de comprobante:** FCR, PRC, RMO, RPF, SDT con transiciones controladas.

---

## Módulo: Gestión de OTs / Lista de Trabajos (M3 — Operaciones)
- **Planilla legacy:** GS-003 (LISTA_TRABAJOS_EN_PROGRESO)
- **Mockup:** `Presentacion/mockups_ui/06_ot_tablero.jpg`
- **Mapeo técnico:** `docs/planillas/lista-trabajos-en-progreso.md`

### Objetivo de la interfaz:
Tablero kanban con estados: PENDIENTE → EN EJECUCIÓN → FINALIZADO → FACTURADO.
- **Descripción de OT visible:** Al abrir una tarjeta, la descripción completa del trabajo se muestra como ayuda.
- **Alertas que bloquean transiciones:** No se puede pasar a "Facturado" si hay: horas sin aprobar, materiales sin OT, RPF pendientes, discrepancias de reconciliación.
- **Habilitación por contratista:** Cada OT se habilita solo para los contratistas autorizados. Sin habilitación, la OT no aparece en sus opciones. Esto fuerza el preaviso del alcance del trabajo.
- **Numeración automática confiable.**

---

## Módulo: Personal y Tarifarios (M2 — Recursos)
- **Planilla legacy:** GS-008 (BD_NEWSYSTEMM)
- **Mockup:** `Presentacion/mockups_ui/07_personal_tarifarios.jpg`
- **Mapeo técnico:** `docs/planillas/bd-newsystemm.md`

### Objetivo de la interfaz:
Panel maestro de personal con configuración quincenal.
- **Tarifarios separados:** Categorías salariales separadas de tarifas por taller. Con vigencia temporal.
- **Dashboard Maestro del Supervisor:** Tipo de cambio USD/ARS se configura una vez por quincena.
- **Alta unificada:** Un solo lugar para dar de alta personal → queda habilitado en todos los módulos según permisos.

---

## Módulo: Resumen Gerencial / Comercial (M5 + M6)
- **Planilla legacy:** GS-004 (RESUMEN_GERENCIAL)
- **Mockup:** `Presentacion/mockups_ui/08_resumen_gerencial.jpg`
- **Mapeo técnico:** `docs/planillas/resumen-gerencial.md`

### Objetivo de la interfaz:
Vista dividida: Costo Interno (izquierda) + Remito Comercial (derecha).
- **Panel izquierdo:** Desglose automático: Mano de Obra, Materiales, Terceros con totales en USD.
- **Panel derecho:** Remito con tarifario precargado, campos de cantidad editables, separación IVA (Exento vs 21%).
- **Barra inferior:** TOTAL REMITO y MARGEN DE OBRA en tiempo real.
- **Emisión en 1 clic:** PDF/Excel idéntico al formato legacy.

---

## Módulo: Comparador de Obras (M7 — Analítica)
- **Mockup:** `Presentacion/mockups_ui/09_comparador_obras.jpg`
- **Mapeo técnico:** `docs/planillas/resumen-gerencial.md` (Sección 7 — Ship Comparison Canvas)

### Objetivo de la interfaz:
Canvas interactivo de arrastrar y comparar.
- **Layout 3 paneles:** Lista de barcos (arrastrables) → OTs filtradas → Tabla comparativa.
- **Métricas por defecto:** Costo total, KG instalados, horas, taller responsable.
- **Métricas ad-hoc:** El gerente inyecta valores (m², cantidad de piezas) y el sistema recalcula ratios.
- **Evaluación de contratistas:** KG/Hora, Costo/KG, modalidad (hora vs presupuesto cerrado).

---

## Módulo: Reconciliación Quincenal (M6 — Cierre)
- **Planillas legacy:** GS-009 + GS-010
- **Mockup:** `Presentacion/mockups_ui/10_reconciliacion.jpg`
- **Mapeo técnico:** `docs/planillas/reconciliacion-horas-materiales.md`

### Objetivo de la interfaz:
Bandeja de reconciliación automática para el supervisor.
- **Detección automática:** Consulta al cerrar quincena detecta retiros de materiales sin horas de respaldo.
- **Tarjetas de alerta:** Cada discrepancia muestra contratista, barco, OT y materiales retirados.
- **Acciones in-situ:** RE-IMPUTAR, CARGAR HORAS, EXCEPCIÓN JUSTIFICADA.
- **Barra de progreso:** % reconciliado de la quincena.
