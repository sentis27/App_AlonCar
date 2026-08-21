---
id: DEC-012
tipo: decision
fase: [2]
estado: confirmado
fecha: 2026-08-21
---

# Decisiones de Diseño: Imputación Horas vs Materiales, PRC vs RMO y Dólar Quincenal

## Contexto
En el análisis del padrón de personal y clasificatorio `B.D.NewSystemm`, se identificaron 3 patrones operativos clave en la gestión del astillero que requerían formalización para el diseño del backend en Supabase y la experiencia de usuario (UX):
1. La diferencia entre imputar costos de materiales (asociados únicamente al Taller) e imputar costos de horas (asociados al Taller + Categoría del Operario).
2. La distinción entre mano de obra presencial por presupuesto (`PRC`) y trabajos realizados externamente en talleres de terceros (`RMO`).
3. El congelamiento del tipo de cambio USD/ARS quincenal y la precarga de tarifarios salariales trimestrales desde un Dashboard Maestro de Supervisión.

## Las Decisiones

### 1. Imputación Diferenciada: Materiales vs Horas
- **Materiales (Pañol):** Los insumos se imputan directamente a la entidad `Workshop` (Taller/Grupo de Trabajo), independientemente del operario que retira.
- **Horas de Trabajo:** Las horas se imputan a `Workshop` + `WorkerCategory` (`RateCard`). 
- **Regla UX App:** Al cargar horas para un taller, el selector desplegable filtrará dinámicamente mostrando solo las categorías salariales asignadas a dicho taller, eliminando la duplicación manual de filas de texto legacy (ej. `AVALOS AYUDANTE`).

### 2. Clasificación en Terceros: Presupuesto (PRC) vs Remito Mano de Obra (RMO)
- **PRC (Presupuesto):** Aplica a mano de obra contratista que trabaja **presencialmente dentro del astillero** bajo presupuesto contratado.
- **RMO (Remito de Mano de Obra):** Aplica a trabajos contratista realizados **externamente en las instalaciones del taller del contratista**.
- **Regla UX App:** El asistente sugerirá crear la cuenta hermana `"Nombre Taller"` para diferenciar la facturación externa sin interferir en los marcajes de asistencia presencial.

### 3. Dashboard Maestro de Supervisión y Dólar Quincenal
- El supervisor fijará quincenalmente la cotización del dólar USD/ARS y las grillas tarifarias del sindicato.
- Todos los cálculos de horas y materiales de una quincena quedarán vinculados a dicho snapshot histórico (`CurrencyRate` y `RateCard`), eliminando las fórmulas `IMPORTRANGE` desde planillas externas.

## Consecuencia en el Modelo de Datos
- Las entidades `Worker`, `Workshop`, `WorkerCategory`, `RateCard` y `CurrencyRate` quedan formalmente articuladas en el módulo M2 (Recursos) y M6 (Cierre/Auditoría).
