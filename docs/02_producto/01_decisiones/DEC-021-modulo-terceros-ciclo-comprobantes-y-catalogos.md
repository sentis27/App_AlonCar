# DEC-021: Módulo de Terceros (GS-005) — Ciclo de Comprobantes, Congelamiento de Dólar y Catálogo Oficial

- **Fecha:** 2026-10-22
- **Estado:** Aprobado e Implementado
- **Módulo:** M3 — Terceros y Talleres Externos (GS-005)
- **Ruta:** `/terceros` (y acceso rápido desde `/ots`)

---

## 1. Contexto de Negocio
El módulo de Terceros representa la **tercera pata del costo de obra** del astillero (junto a Horas y Materiales). Reemplaza la planilla histórica GS-005, eliminando la necesidad de copiar y pegar valores a mano para congelar el dólar y resolviendo el descontrol en el seguimiento de remitos de talleres externos y facturas pendientes.

---

## 2. Decisiones Clave de Negocio Aprobadas

### 2.1 Ciclo de Comprobantes (DEC-017)
1. **PRC (Presupuesto / Trabajo en Planta):** Aplica a todo trabajo realizado dentro de las instalaciones del astillero (Varadero / Muelle). Estado definitivo, no evoluciona. Locación: `PLANTA`.
2. **RMO (Remito Mano de Obra):** Trabajos ejecutados en taller externo del contratista. Constancia operativa inicial. Evoluciona a `FCR` o `SDT`. Locación: `TALLER`.
3. **RPF (Remito Pendiente de Factura):** Estado transitorio de alerta administrativa. Remito valorizado que genera alerta visual urgente en la terminal de María José para exigir la factura oficial al proveedor. Evoluciona obligatoriamente a `FCR`. Locación: `TALLER`.
4. **FCR (Factura Fiscal Oficial):** Estado final respaldatorio con número legal de factura.
5. **SDT (Sin Documentación):** Estado final para costos o trabajos cerrados excepcionalmente sin factura fiscal.

### 2.2 Cotización de Dólar Oficial Congelado por Fecha de Carga
- La cotización se toma por la **fecha de carga del dato ingresada a mano** (`entry_date`).
- El sistema consulta automáticamente la tabla `public.macro_variables` según el año, mes y día de carga:
  - Días 1 al 15: `dollar_rate_1q`.
  - Días 16 al fin de mes: `dollar_rate_2q`.
- El valor queda congelado en la fila (`usd_rate` y `amount_usd = amount_ars / usd_rate`).

### 2.3 Permisos de Edición de Montos
- **Solo María José y Jorge Sentis (Admin)** tienen autorización para editar importes en pesos o dólares una vez guardados.
- Para los demás perfiles (Jefes de Obra, Supervisores, Dirección), el campo de monto está bloqueado con candado 🔒 y advertencia visual.
- Cualquier modificación de monto queda asentada en la tabla `public.audit_logs`.

### 2.4 Catálogo Oficial de Proveedores de Terceros
- Se integraron los 251 proveedores únicos del catálogo oficial (PDF de Terceros y Talleres).
- **Restricción estricta de permisos en Padrón (`public.workers`):**
  - `can_charge_third_party = true`
  - `can_withdraw_materials = false` (No retiran materiales de Pañol)
  - `can_impute_hours = false` (No cargan horas de personal propio)
- **Contratistas Polirrubro ("MANUAL"):** Los contratistas que en el listado oficial figuran con rubro `MANUAL` son polirrubro (ej. Alon Car SA, Atlántica Gas, Birigain, Ordoqui). En lugar de fijarles un oficio rígido, el formulario de carga detecta la condición y exige al operador seleccionar el rubro aplicable al trabajo de una lista oficial predeterminada de 24 rubros sin inventar.

### 2.5 Terminales de Trabajo Especializadas por Rol
1. **Terminal Administrador General (Jorge Sentis):** Control total, aprobación de excepciones SDT, edición de montos y gobernanza.
2. **Terminal Administración Comercial (María José):** Carga y valorización, reclamo activo de facturas pendientes (RPF), evolución rápida a FCR.
3. **Terminal Jefes de Obra / Supervisión (Omar / Pablo / Ale):** Conformidad técnica (Conforme / Observado), notas de inspección, control de piezas enviadas a taller con Remito Aloncar.
4. **Terminal Dirección (Hugo):** Solo lectura estratégica de costos en USD y alertas de desvío.

---

## 3. Modelo de Datos y Migración 0021
- Se amplió la tabla `public.third_party_services`:
  - `service_date`, `entry_date`, `voucher_type`, `voucher_number`, `voucher_date`, `service_location`, `internal_remito_number`, `trade`, `amount_ars`, `usd_rate`, `amount_usd`, `direct_observations`, `specific_observations`, `audit_status`, `audit_notes`, `audited_by`, `audited_at`, `created_by`.
- Se creó la tabla `public.third_party_voucher_history` para la trazabilidad inmutable de cambios de estado (RMO ➔ FCR, RPF ➔ FCR).
- Se sembraron 10 registros históricos de muestra basados en la planilla GS-005 para inicializar el módulo con datos representativos.
