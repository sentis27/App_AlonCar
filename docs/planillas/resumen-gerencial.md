# Mapeo Legacy: RESUMEN GERENCIAL (GS-004)

> [!IMPORTANT]
> **Fuentes de información cruzadas:** Descripción exhaustiva del usuario (sesión 2026-07-23), lectura de metadatos vía MCP (detectando 18+ hojas internas y consultas QUERY complejas).

---

## 1. Clasificación de la Planilla
- **Tipo de Planilla:** TIPO C (Salida / Reporte)
- **Justificación:** Es el núcleo analítico (Dashboard) del sistema. No es su función principal capturar datos nuevos, sino **consolidar y procesar** la información proveniente de Horas, Materiales y Terceros para presentar resúmenes ejecutivos.
> Confianza: CONFIRMADO

## 2. Identidad y Contexto de Negocio
- **ID Planilla:** GS-004
- **Nombre Técnico/Funcional:** RESUMEN_GERENCIAL (Dashboard de Costos de Obra)
- **URL / ID:** `https://docs.google.com/spreadsheets/d/1pcHSIPRWmcCDMijy_jccdsxKyVxu3wnC5ltCcYYW8ck/edit`
- **Departamento Propietario:** Dirección de Obra / Gerencia / Administración
- **Usuarios Principales y Rol:** Jefes de Obra y Directivos que requieren visibilidad total de los costos para toma de decisiones y facturación.
- **Propósito Principal:** Centralizar y desglosar todos los costos de la obra agrupados por Barco/Cliente y por Orden de Trabajo. Permite identificar desviaciones, revisar horas invertidas vs presupuestadas y emitir el análisis final previo a la facturación.
- **Integraciones Manuales Actuales:** 
  - Selección humana del Cliente/Barco (B4) y la Orden de Trabajo (C4) para detonar los filtros interactivos en la hoja `RESUMEN`.
  - Padece de cuellos de botella enormes: requiere consolidar previamente exportaciones de Terceros, Materiales y Horas mediante fórmulas (ej. `sort`) generando una tabla (`B.D RESUM.GERENCIAL`) con más de 60,000 registros, de los cuales solo el 30% está activo.
> Confianza: CONFIRMADO

## 3. Estructura Visual y Navegación
La planilla es extremadamente densa, compuesta por 18+ hojas (muchas de paso intermedio). Las principales son:

- **Dashboard Principal (`RESUMEN`):** 
  - Panel interactivo. Tiene 2 niveles de análisis:
    1. *Costo General de Obra* (filas 7-16): Muestra métricas totales de toda la obra con gráficos de distribución (pasteles para costo por OT, Kg distribuidos, horas por rubro, etc.).
    2. *Costos Específicos por OT* (filas 18-28): Mismas métricas pero filtradas a nivel microscópico por la Orden seleccionada.
  - Posee hipervínculos como accesos directos para saltar a otras hojas de desglose.
- **Resumen Tabular (`resumen 2`):** 
  - Pantallazo rápido (tabla) con todas las OTs. Desglosa: Terceros, Materiales, Consumibles, Horas.
  - Presenta Agrupadores: *Materiales (Material + Consumibles)* y *Mano de Obra (Horas + Terceros)*. Muestra el Peso (Kg) total y la descripción textual de la OT.
- **Alertas de Costos (`Resumen 3`):** 
  - Matriz de OT vs Rubros de Horas.
  - **Función Clave:** Muestra "Datos sin Valor" (ítems sin valorizar). Esencial para detectar cuando un trabajo fue cargado pero falta asignarle precio/tarifa (ej. contratistas nuevos).
- **Reporte Jefe de Obra (`descripcion trabajos`):**
  - Muestra OT, descripción y cantidad de Horas. Servía de puente para exportar a un dashboard externo.
- **Vistas Especiales:** `Rubros vs Costos` (para detectar picos atípicos por errores de tipeo de operarios) y hojas resumen directas (`HORAS`, `TERCEROS`, `MATERIALES`).
- **Cálculo Backend (`CALC.GENERALES`, `CALC.OT`):** Hojas ocultas/intermedias donde se preparan los datos crudos para alimentar los gráficos del dashboard.
> Confianza: CONFIRMADO

## 4. Estructura de Datos y Métricas Clave

A diferencia de las planillas de carga (Tipo A/D), aquí importan los **Indicadores (KPIs)** presentados:

| KPI / Métrica | Nivel de Agrupación | Fuente de Datos | Notas |
|---|---|---|---|
| COSTO DIRECTO TOTAL US$ | Por Obra / Por OT | Sumatoria Global | El valor central para facturación. |
| TOTAL MATERIALES | Por Obra / Por OT | Planilla GS-002 | Separado conceptualmente de "Consumibles". |
| TOTAL MAT. CONSUMIBLES | Por Obra / Por OT | Planilla GS-002 | Permite analizar el gasto invisible de la obra (discos, electrodos, gas). |
| TOTAL TERCEROS | Por Obra / Por OT | Planilla GS-005 | Gasto en talleres y proveedores externos. |
| TOTAL HORAS (US$ y Cantidad) | Por Obra / Por OT | Planilla GS-001 | Costo interno + horas de grúa/pala separadas. |
| TOTAL PESO (Kg) | Por Obra / Por OT | Planilla GS-002 | Distribución del tonelaje de acero/metales despachado. |
| FECHA ÚLTIMO REPORTE | Por Obra | `descripcion trabajos` | Actualmente usa `=HOY()`. **Regla futura:** Debe calcular el `MAX(Fecha)` real de los consumos de ese cliente. |

> Confianza: CONFIRMADO

## 5. Lógica de Validaciones y Alertas
- **Control de Integridad (Ítems sin Valorizar):** La hoja `Resumen 3` hace un barrido de las imputaciones buscando costos $0.00. Si un operario cargó horas, pero no tiene tarifa asignada, alerta al supervisor administrativo para que asigne el costo antes de facturar.
- **Detección de Anomalías (Picos):** El gráfico de `Rubros vs Costos` es una herramienta forense. Si se tipea accidentalmente 1000 horas en lugar de 10, este gráfico revienta, permitiendo al auditor cazar el error antes de presentar la liquidación al cliente final.
> Confianza: CONFIRMADO

## 6. Lógica de Código (Apps Script / Fórmulas)
- **Extensivo uso de `=QUERY()`:** El backend del Excel funciona a base de Queries complejas a la gigantesca hoja `B.D RESUM.GERENCIAL` (ej. `=QUERY('B.D RESUM.GERENCIAL'!A:T,"SELECT * WHERE B='"&B4&"'")`).
- **Problema de Rendimiento Crítico:** Mantener 60,000+ filas, de las cuales 42,000 son datos históricos "muertos", obliga a la herramienta a procesar arreglos innecesariamente grandes en cada cambio de celda (B4), volviendo la planilla lenta y propensa a cuelgues.
> Confianza: CONFIRMADO

## 7. Mapa Relacional de Dependencias (CRÍTICO)

- **Dependencias Entrantes (De dónde consume):**
  | Planilla Origen | Lógica de Negocio |
  | :--- | :--- |
  | GS-001 (HORAS) | Imputaciones de operarios, grúas, pala. |
  | GS-002 (MATERIALES) | Remitos de pañol, consumibles, chapas y pesos. |
  | GS-005 (TERCEROS) | Certificados de talleres externos, remitos de MO. |
  | B.D.NewSystemm | Lista maestra de Barcos y OTs. |
  | Consolidado Final (Puente) | *Workaround* actual del usuario para hacer un "UNION" (sort) de todas las planillas de costos antes de meterlas aquí. |

- **Dependencias Salientes (Quién la consume):**
  - Finanzas / Dirección (Para emitir presupuestos finales, facturas y reportes de rentabilidad).
> Confianza: CONFIRMADO

## 8. Validaciones y Constraints de Negocio

| Regla de Negocio / Constraint | Entidad / Tabla Responsable en SQL | Estado Actual en el Astillero |
| :--- | :--- | :--- |
| **Fecha Real de Carga:** El "Último dato cargado" para el Jefe de Obra debe reflejar el `MAX(Timestamp)` de las imputaciones de ese barco, para auditar demoras en la carga humana. | `TimeImput` / `Consumption` | Usa fórmula estática `=HOY()`. |
| **Control de Acceso (RLS):** Siendo el cerebro financiero de la empresa, no todos los operarios deben verla. El Jefe de Obra A solo debería ver los costos de los Barcos de A. | Roles y Permisos (Supabase RLS) | Abierta / Compartida sin segmentación real por fila. |
| **Archivo Histórico:** Datos de obras finalizadas y facturadas deben congelarse y salir de la vista de cálculo activo para no perjudicar la performance. | `HistoricalData` / Flag `is_archived` | Todo vive en la misma matriz de 60,000 líneas. |

> Confianza: CONFIRMADO

## 9. Requerimientos de Migración a Supabase/n8n

- **Entidades del catálogo implicadas:** Módulo M6 (`ClosureLog`, `HistoricalData`, `AuditTrail`) y M5 (`BillingItem`).
- **La Solución al Rendimiento (Supabase SQL Views):**
  - **TODO** el dolor de cabeza de "exportar, ordenar (sort) y consolidar planillas" desaparece en PostgreSQL. 
  - Se creará una **Materialized View** (ej. `vw_costos_consolidados`) que haga un `UNION ALL` nativo de las tablas `TimeImput`, `Consumption` y `ThirdPartyService`. Esto permitirá agrupar y sumar costos (GROUP BY WorkOrder) en milisegundos sin importar si hay 60,000 o 1,000,000 de filas.
- **Dashboard en UI Moderno (Next.js / Retool):**
  - La hoja `RESUMEN` será reemplazada por un verdadero Dashboard analítico con filtros dinámicos superiores (Cliente, OT, Fechas).
  - Los gráficos (Recharts / Chart.js) tomarán la data ya calculada por la base de datos, eliminando la necesidad de hojas puente como `CALC.GENERALES`.
- **Automatizaciones y Flujos Candidatos:** 
  1. **"Congelamiento de Obra" (Botón de Archivo):** Al finalizar y facturar una obra, un botón en la UI cambiará el estado de la obra a "Archivada" (`is_archived = TRUE`), moviendo automáticamente todos sus costos a `HistoricalData` (o particionando la tabla), liberando la caché y memoria de la operación diaria.
  2. **Alerta Proactiva "Costos sin Valor":** Un cron job (n8n) que revise cada noche si hay imputaciones en OTs activas con tarifa $0.00, enviando un recordatorio/email a Administración para que pacte precios antes de que el trabajo se enfríe.
  3. **Row Level Security (RLS) en UI:** Autenticación donde el perfil del usuario determine si puede ver solo el progreso de "Barco X" o todo el "Resumen Gerencial" (Rol: Admin).

## 9.5. Analíticas Avanzadas Solicitadas (Nuevos Requerimientos)

En base a la evolución del modelo, se incorporarán tres herramientas analíticas interactivas en la nueva aplicación, resolviendo limitaciones actuales de Excel:

### A. Filtro Interactivo de Horas de Contratista por OT
- **Problema:** El Jefe de Obra necesita ver rápidamente las horas exclusivas de un contratista en un barco/OT, excluyendo horas de presupuesto cerrado que ya entran como costo de "Terceros" (para evitar duplicidad). Hoy esto requiere filtros manuales complejos en GS-001.
- **Solución Propuesta:** Un módulo visual de "Auditoría de Contratista". Con simples selectores desplegables (dropdowns) de Barco y Contratista, el sistema consultará directamente a `TimeImput` (filtrando tipos de trabajo) y devolverá las horas directas. Una UI a prueba de errores para usuarios sin experiencia en planillas.

### B. Dashboard Interactivo Libre (Estilo Tabla Dinámica / Canva)
- **Problema:** El análisis estático actual no permite aislar variables al vuelo (ej. ver solo costos de "corte y plegado" en un barco específico).
- **Solución Propuesta (Data Grid / Pivot UI):** Se implementará un componente de "Tabla Dinámica Web" (Pivot Table). Esto funciona visualmente arrastrando y soltando (drag & drop) etiquetas ("Barco", "Rubro", "Contratista") hacia los ejes de filas o columnas, recalculando los costos instantáneamente. Es la versión moderna, segura y ultra rápida de cruzar datos, permitiendo armar tableros (Canva) dinámicos sin tocar código ni fórmulas.

### C. Análisis Histórico de Variación de Costos (Hora Hombre vs Consumibles)
- **Objetivo:** Evaluar la evolución del costo por Hora-Hombre a lo largo de las quincenas.
- **Propuesta de Análisis y Cruce de Datos:**
  1. **Eje Temporal (X):** Agrupación estricta por `Quincena`.
  2. **Eje de Costo Horas (Y1):** Métrica de **Valor Tabulado (US$/Hora)**. Aquí **no** se mezclan ni se promedian los trabajos por presupuesto cerrado (eso irá en "Avance de Obra"). Se grafica puramente la evolución de la tarifa plana por hora-hombre pactada con ese contratista.
  3. **Eje de Consumos (Y2):** Métrica `(Total US$ en Consumibles y EPP del contratista) / (Cantidad de Horas)`. Revela cuánto le cuesta al astillero (en insumos) cada hora tabulada que trabaja esa persona.
  4. **Cruce Cambiario (Dólar):** Se superpone una línea de tendencia del valor Dólar de la quincena (extraído del Dashboard Maestro). 
  5. **Insight de Negocio:** Este gráfico permite detectar visualmente si un aumento de costos se debió a (A) actualización de la tarifa tabulada, (B) salto cambiario, o (C) derroche de consumibles del pañol por parte del contratista.

## 10. Conclusión del Módulo

Esta planilla no se "migra" celda por celda. **Se reconstruye conceptualmente.** Las hojas de cálculo intermedio (`CALC`, `B.D`) se evaporan en favor de consultas SQL puras. El esfuerzo de desarrollo aquí estará 100% centrado en crear una interfaz de usuario visualmente imponente (Dashboard) y en configurar las políticas de seguridad de la base de datos (RLS) para proteger los costos del astillero.

> Confianza: CONFIRMADO
