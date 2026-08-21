---
id: DEC-014
tipo: decision
fase: [2]
estado: confirmado
fecha: 2026-08-21
---

# Decisiones de Diseño: Resumen Gerencial, Tarifario Nivel Alfa, Remitos de Cobro y RBAC

## Contexto
En el análisis del `Resumen Gerencial` (`GS-004`), `DETALLE DE PRESUPUESTOS` (`GS-011`), `LISTA TRABAJOS EN PROGRESO` (`GS-003`) y `PROTOTIPO PUESTA EN SECO` (`GS-012`), se definieron requerimientos clave para la gestión ejecutiva y el cierre comercial de obras:
1. La creación del Tarifario Maestro de Puesta en Seco (`DrydockRateCard`) con descripciones textuales literales y tarifas base en USD.
2. El control de acceso de seguridad **Nivel Alfa (Gerencia General Exclusiva)** para modificar tarifas base del catálogo maestro.
3. La eliminación de idas y vueltas entre planillas mediante una vista única dividida de Costo Interno Real vs Redacción del Remito Comercial.
4. La distinción entre campos fijos autocompletados vs campos abiertos para carga de datos operativos ($m^3$ tanques, unidades válvulas, ánodos de zinc, flags `1/0`).
5. La visualización de horas de presupuesto (PRC/RMO) e indicadores de % Avance.
6. El resumen acumulado comercial con discriminación de IVA, total exento, total gravado y Margen Global de Obra.

## Las Decisiones

### 1. Tarifario Maestro Puesta en Seco (Acceso Nivel Alfa)
- Creación del catálogo maestro `DrydockRateCard` con descripciones textuales literales y precios unitarios USD base para la plantilla de Puesta en Seco (barcos hasta 30m). Documentado en `docs/03_negocio/tarifario_puesta_en_seco_alfa.md`.
- **Seguridad Nivel Alfa:** Solo la Gerencia General puede modificar los precios unitarios base de este catálogo.

### 2. Separación de Campos Fijos vs Inputs Cuantitativos de Obra
- **Campos Fijos:** Descripciones textuales y precios unitarios USD autocompletados desde el Tarifario Nivel Alfa.
- **Campos Abiertos para Carga:** Días/Horas, Metros Cúbicos ($m^3$) en Tanques, Cantidad de Válvulas, Ánodos de Zinc, Puntos de Sondaje y Flags `1/0` en Mecánica.

### 3. Unificación en Pantalla Única (Sin Idas y Vueltas)
- La App muestra en paralelo el **Costo Interno Incurrido** (panel izquierdo) y la **Redacción Comercial del Remito** (panel derecho) con desglose de Mano de Obra, Materiales, Exento, Gravado e IVA 21%.

### 4. Modelos de Cobro (Puesta en Seco vs Prototipo Básico Aflote)
- Soporte para `Puesta en Seco (Barcos hasta 30m)` (estandarizado con indicadores técnicos) y `Prototipo Básico` (escritura libre para trabajos aflote o entregas de taller).

### 5. Workspace Analítico Interactivo
- Clics en celdas de totales gerenciales transfieren a un **Workspace Analítico** con atajos (`🎯 Materiales con Peso KGS > 0`) y agrupamiento dinámico por Rubro, OT o Contratista.

### 6. Control de Acceso por Roles (RBAC)
- **Nivel Alfa (Gerencia General):** Acceso total (Modificación del Tarifario Maestro `DrydockRateCard`, Precios de Venta, IVA, Remitos y Margen Global).
- **Supervisores / Jefes de Obra:** Acceso a Costos Directos, Horas, Avance %, Pesos (KG) e Inputs Cuantitativos de Obra. Oculta la modificación de tarifas base y márgenes comerciales.

## Consecuencia en la Arquitectura
- El módulo M5 (Comercial) y M2 (Recursos/Tarifarios) articularán `DrydockRateCard`, `WorkItemMetric` e `InvoiceAttachment` con `WorkOrder`, automatizando desde el costo real hasta el remito al cliente armador.
