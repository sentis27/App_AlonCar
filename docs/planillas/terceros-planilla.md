# Mapeo Legacy: PLANILLA DE TERCEROS (Aprobado)

> [!IMPORTANT]
> **Fuentes de información cruzadas:** Descripción detallada del usuario (sesión 2026-07-22), lectura directa vía API MCP (Google Sheets — valores, hojas, metadatos, y análisis completo del código Apps Script).

---

## 1. Clasificación de la Planilla
- **Tipo de Planilla:** TIPO D (Híbrida)
- **Justificación:** Funciona como base de **entrada** de datos operativos (costos de talleres, mano de obra externa, presupuestos); **consume y transforma** datos importados (Barcos/OTs vía `B.D.IMPORTADA`, materiales vía `B.D.IMPORT.MATERIALES`); y emite **salidas** tanto internas (dashboard `ALERTAS`) como análisis de costos específicos con lógica (hoja `CONTROL C.C_PAMAPA NAVAL`).
> Confianza: CONFIRMADO

## 2. Identidad y Contexto de Negocio
- **ID Planilla:** GS-005
- **Nombre Técnico/Funcional:** TERCEROS_PLANILLA_COSTOS
- **URL / ID:** `https://docs.google.com/spreadsheets/d/1dwNpAEjdjyKks-VFAOQWWcJAaqrRfPAI1BioCHz9sbg/edit`
- **Departamento Propietario:** Administración / Dirección de Obra
- **Usuarios Principales y Rol:** Administrativos encargados de cargar facturas, remitos y presupuestos (PRC) de proveedores/contratistas externos.
- **Propósito Principal:** Es la central de carga para agrupar los costos de contratistas y servicios de terceros, vinculándolos a Barcos y Órdenes de Trabajo (OT). Es la tercera pata del costo de obra (junto a Horas y Materiales). Secundariamente, busca cruzar información con materiales despachados (vía N° de Remito Aloncar) e intentó funcionar como un sistema de Cuenta Corriente rudimentario para proveedores (Estado del PRC).
- **Frecuencia de Uso:** Diaria.
- **Integraciones Manuales Actuales:** 
  - Carga manual de facturas (FCR), remitos (RMO), y presupuestos (PRC). 
  - Carga manual/redundante de nuevos proveedores en la hoja `BD_Talleres`.
  - **Congelamiento manual del Dólar:** Cada vez que cambia el dólar, el operario debe seleccionar todos los ítems valorizados históricamente, copiarlos y pegarlos (Pegado Especial > Valores) para congelar su precio. Luego, actualiza a mano la celda D1 (o la correspondiente) con el nuevo valor del dólar.
> Confianza: CONFIRMADO

## 3. Estructura Visual y Navegación
- **Hojas Existentes:**
  - **TAB-001:** ALERTAS (Dashboard)
  - **TAB-002:** TERCEROS (Hoja CRÍTICA central de carga)
  - **TAB-003:** CONTROL C.C_PAMAPA NAVAL (Panel procesado vía Apps Script para control de liquidaciones a un taller específico)
  - **TAB-004:** BUSQUEDA DE MATERIALES (Herramienta interactiva para cruzar N° Remito con consumo de materiales)
  - **TAB-005:** B.D.IMPORT.MATERIALES (Importada desde Planilla GS-002)
  - **TAB-006:** B.D.IMPORTADA (Importada con datos de Barcos/OTs)
  - **TAB-007:** BD_Talleres (Base de datos local fragmentada de proveedores y rubros)
- **Fila Real de Encabezados:** Fila 2 en hoja `TERCEROS`. Fila 4 en `CONTROL C.C_PAMAPA NAVAL`.
- **Dashboard / Sumatorias Superiores:** La hoja `ALERTAS` consolida conteos de campos faltantes leídos de columnas ocultas W-AE en `TERCEROS`.
> Confianza: CONFIRMADO

## 4. Estructura de Datos y Columnas

**(TAB-002) TERCEROS** — Hoja de Carga Central.
| Col | Nombre | Tipo | Ingreso | Notas / Fórmulas Clave |
|---|---|---|---|---|
| A | FECHA | Date | MANUAL | Fecha del gasto/factura/remito. |
| B | BARCO | String | LISTA_DINAMICA | Validación desde `B.D.IMPORTADA`. |
| C | ORDEN DE TRABAJO | String | SCRIPT | Validación dinámica inyectada por Apps Script (`onEdit`) en base al barco. |
| D | PROVEEDOR | String | MANUAL_VALIDADO | Proveedor que ejecuta. Se carga desde `BD_Talleres`. |
| E | TIPO DE TRABAJO | Enum | MANUAL | Constante "TERCEROS" para agrupar costos. |
| F-H | (Horas / Heredadas) | N/A | OCULTAS | Columnas muertas heredadas de GS-001 (Horas). Inútiles aquí. |
| I | RUBRO | String | FORMULA | CRÍTICO. Se llena automáticamente con `=SI(A4="";"";(SI.ERROR(SI(D4<>"";BUSCARV(D4;BD_Talleres!B:C;2;FALSO)))))`. Define imputación contable. |
| J-K | (Materiales / Heredadas) | N/A | OCULTAS | Heredadas de GS-002 (Materiales). Inútiles aquí. |
| L | PRECIO/UNI AR$ | Number | MANUAL | Costo base en pesos. |
| M | COSTO TOTAL US$ | Number | FORMULA | Conversión del costo AR$ según celda "VALOR DOLAR" (L1=1500) vigente de la quincena. |
| N | PESO | N/A | OCULTA | Heredada. Inútil aquí. |
| O | CENTRO DE COSTO | String | FORMULA | Constante "CLIENTE", con fórmula de seguridad para exportación. |
| P | CATEGORIA | N/A | OCULTA | Heredada. Inútil aquí. |
| Q | TIPO DE COMPROBANTE | Enum | MANUAL | FCR (Factura), PRC (Presupuesto Interno), RMO (Remito Mano Obra), RPF (Remito Pdte. Factura), SDT (Sin Documentación). |
| R | Nº FACTURA/COMPR. | String | MANUAL | Número legal o número correlativo interno para PRC. |
| S | OBSERVACIONES | String | MANUAL_LIBRE | Fundamental: aquí se describe el trabajo. De acá se deduce el "Rubro" (col I). |
| T | MARCA TEMPORAL | DateTime | AUTO | Momento de carga en sistema. |
| U | ESTADO DEL PRC | Enum | MANUAL | "Cancelado" / Vacío. Intento fallido de llevar Cuenta Corriente (Pago). |
| V | Nº REMITO ALONCAR | String | MANUAL | CRÍTICO. Vincula este trabajo de mano de obra con los materiales entregados en Pañol (cruce directo). |
| W-AE | ALERTAS INTERNAS | Boolean | FORMULA | Columnas ocultas que detectan si falta OT, Rubro, Precio, etc., alimentando el Dashboard `ALERTAS`. |

> Confianza: CONFIRMADO

## 5. Lógica de Validaciones y Alertas
- **Validaciones en Cascada (Barco -> OT):** Dependencia obligatoria. Al elegir el Barco en col B, el Apps Script genera la validación en col C para mostrar solo las OTs correspondientes.
- **Lógica de Alertas:**
  - El panel principal muestra recordatorios cruzados:
    - Faltantes críticos: Sin Precio, Sin OT, Sin Tipo Trabajo, Sin Centro Costo.
    - Operativos: **"RPF CON COSTO"**. Si el tipo de comprobante es RPF (Remito pendiente de factura), avisa a la administración que se debe reclamar a ese proveedor su correspondiente factura oficial.
- **Herramienta "Búsqueda de Materiales":** Al digitar el "N° Remito" (celda A3), la hoja filtra `B.D.IMPORT.MATERIALES` y devuelve la lista de materiales consumidos. **Objetivo de negocio:** Permitir al auditor revisar si la mano de obra cobrada (Terceros) concuerda lógicamente con los materiales retirados por ese taller. Al dar OK, el remito se pre-archiva.
> Confianza: CONFIRMADO

## 6. Lógica de Código (Apps Script)
- **¿Posee código atado (`.gs`)?**: Sí. Detectadas 2 rutinas principales.
- **Funciones Detectadas:**
  1. `onEdit()`:
     - **Qué hace:** Escucha ediciones en columna B (Barco). Al detectar cambio, busca el Barco en `B.D.IMPORTADA`, calcula el rango exacto de sus OTs, e inyecta dinámicamente un `DataValidation` en la celda adyacente (Col C).
     - **Riesgo:** Alto acoplamiento a las posiciones de columnas en `B.D.IMPORTADA`.
  2. `procesarDatosPampaNaval()`:
     - **Qué hace:** Script altamente específico. Extrae `B.D.IMPORT.MATERIALES`, filtra trabajos relacionados con "INA PANTOGRAFO", y ordena por Fecha + Remito (ascendente). Usa un Mapa en memoria para vincular eficientemente fechas con remitos.
     - **Propósito:** Liquidar servicios del cliente/taller "Pampa Naval" calculando sumas condicionales y definiendo las Quincenas (ej. "1RA oct 2024") basándose en las fechas.
     - **Problema de Negocio:** Todo este script existe por falta de una herramienta que multiplique Kilos procesados x Tarifa Acordada (USD) por quincena. 
> Confianza: CONFIRMADO

## 7. Mapa Relacional de Dependencias (CRÍTICO)

- **Dependencias Entrantes (De dónde consume):**
  | Planilla Origen | Hoja Origen | Lógica de Negocio |
  | :--- | :--- | :--- |
  | B.D.NewSystemm | (Vía B.D.IMPORTADA) | Lista de Barcos y OTs para la validación en cascada del onEdit. |
  | GS-002 (Materiales) | (Vía B.D.IMPORT.MATERIALES) | Toda la base de consumos. Se usa en "Busqueda de Materiales" y "Control Pampa Naval". |
  | (Interno / Manual) | BD_Talleres | Base fragmentada de proveedores y rubros. |

- **Dependencias Salientes (Quién la consume):**
  | Planilla Destino | Qué Exporta | Para qué lo usa |
  | :--- | :--- | :--- |
  | GS-004 (Resumen Gerencial) | Costos USD por OT | Totalización de la pata "Terceros" del costo de la obra. |
> Confianza: CONFIRMADO

## 8. Validaciones y Constraints de Negocio

| Regla de Negocio / Constraint (¿Qué debe bloquear o fallar?) | Entidad / Tabla Responsable en SQL | Estado Actual en el Astillero |
| :--- | :--- | :--- |
| **Alta centralizada de Proveedores:** Todo proveedor que preste servicios/venda consumos debe existir en un catálogo global con su Rubro por defecto. | `Supplier` / `Workshop` + FK Constraints | **Fragmentado.** Existe `BD_Talleres` localmente, lo que obliga a carga redundante y errores de tipeo. |
| **Cruce Remito-Material (Integridad Operativa):** El "N° Remito Aloncar" cargado aquí DEBE existir en la base de Consumos del pañol. | `ThirdPartyService` -> `MaterialConsumption` (Cruce) | **Manual visual.** El usuario debe tipear el ID en "Búsqueda" y comparar visualmente que coincidan. |
| **Seguimiento de RPF:** Todo registro en estado RPF (Remito pendiente factura) debe transicionar a FCR en el tiempo, de lo contrario bloquea pagos o genera alertas contables. | `InvoiceAttachment` / `BillingItem` | **Alerta visual.** Solo se marca con una bandera en el dashboard `ALERTAS`. |
| **Dólar Quincenal Unificado:** La tasa de conversión (USD/AR$) para liquidar a los terceros no puede ser una celda escrita a mano; debe ser oficial por período. | `CurrencyExchange` / RateCard | **Hardcodeado.** Se tipea manualmente (1500) en L1. |

> Confianza: CONFIRMADO

## 9. Requerimientos de Migración a Supabase/n8n

- **Entidades del catálogo implicadas:** `WorkOrder` (Asignación del costo), `Workshop` / `Worker` (Proveedor que hace el trabajo).
- **Gaps de Roadmap detectados:** 
  1. `ThirdPartyService` o `ServiceImput`: Hoy en el catálogo solo tenemos `TimeImput` (horas internas) y `Consumption` (materiales). Falta la entidad que reciba el costo explícito de un tercero, con monto (AR$/USD), comprobante y remito.
  2. `SupplierAccount` (Cuenta Corriente): El usuario intentó implementar un estado de cuenta (Columna U: Estado PRC). Es necesario modelar un `Ledger` o módulo de cuentas por pagar a talleres en futuras iteraciones.
  3. `GlobalConfig` o `DashboardMaestro`: Entidad para gestionar el valor de conversión USD/AR$ activo por quincena.
- **Campos a Conservar:** Fecha, Barco, OT, Proveedor, Rubro, Precio AR$, Costo USD, Tipo de Comprobante, N° Factura/PRC, Observaciones, N° Remito Aloncar.
- **Campos a Descartar (Basura):** F (Horas al 50%), G (Horas al 100%), J (Materiales), K (Cantidad), N (Peso), P (Categoría). O (Centro de Costo "Cliente" como constante estática).
- **Automatizaciones y Flujos Candidatos (n8n/UI):** 
  1. **Alta Unificada de Proveedores In-Situ:** Esta lógica aplica a todas las planillas de uso administrativo (Personal, Terceros, Compras). El módulo de "Personal", por ejemplo, da el alta para ingreso al astillero, lo que habilita que ese contratista aparezca en las estaciones operativas (Horas y Materiales). Las estaciones operativas **NO** tendrán este botón de creación, ya que el poder de ingresar datos base de sistema es exclusivo de la Administración.
  2. **NLP / IA para sugerencia de Rubro:** Al escribir "corte y plegado de chapas navales" en Observaciones, el sistema debe autoseleccionar/sugerir "Corte y Plegado" (Rubro), dejando al humano dar el "Aceptar".
  3. **Auto-verificación de Remito:** Al cargar el "N° Remito Aloncar", la UI debería mostrar una tarjeta flotante al costado con los materiales exactos que fueron retirados del pañol bajo ese remito, haciendo la verificación instantánea sin necesidad de otra pestaña.

## 10. Observaciones, Problemas Frecuentes y Mejoras

- **Problemas Frecuentes:**
  - *Base de Proveedores Desincronizada:* Administrativos deben cargar a los talleres múltiples veces si trabajan en diferentes áreas. Si portería da ingreso a un "Teco Taller", terceros debe crearlo de nuevo a mano.
  - *Cambios de Dólar Manuales:* El "Valor Dólar" se sobreescribe manual. Si la quincena cierra y cambian el dólar antes de exportar o sin guardar la foto anterior, los costos históricos AR$ vs USD se deforman.
- **Mejoras Identificadas (Rumobo a la App):**
  - *Alta Prioridad (Gestión de Proveedores):* Master Data unificado de Proveedores con módulo de alta express desde cualquier pantalla (Compras o Terceros), sugiriendo nombres existentes con fechas de ingreso recientes para evitar duplicados.
  - *Alta Prioridad (Dashboard Maestro):* Crear el panel central que controle **Variables de Tiempo y Dinero** (Valor Dólar vigente, Fechas de Quincena activa) y **Tarifas Pre-Acordadas** (Ej. US$/Kg tabulado para Pampa Naval o soldadores), agilizando el cierre de facturas a simple click por parte del administrativo (en vez de requerir visto bueno manual del jefe para cada valor).
  - *Media Prioridad (Cuenta Corriente):* Dejar pre-armado el esquema de Base de Datos para que en la Fase 2 (después de costos de obra) se lance el "Módulo de Cuentas Corrientes" nativo, eliminando Excel.
- **Deuda Técnica (A Limpiar):** 
  - Columnas basura heredadas en la planilla de carga. 
  - Scripts como `procesarDatosPampaNaval()` que implementan joins relacionales y lógica de negocio (kilos x dólar x remito) que Supabase resolverá con una simple SQL View.

> Confianza: CONFIRMADO
