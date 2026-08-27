# ⚓ Reglas de Negocio Transversales

Este documento consolida las reglas operativas y de negocio que aplican de forma global a todos los módulos del sistema (Activos, Recursos, Operaciones, Logística, Comercial y Analítica).

## 1. Gestión de Trabajos Internos y de Infraestructura

Las labores propias de mantenimiento del astillero (ej. mantenimiento de predio, reparación de equipos, operación de varadero) tienen un impacto directo en el consumo de recursos (pañol, horas de personal) pero no se facturan a un cliente externo. Para mantener la contabilidad aislada y permitir la analítica de costos, aplican las siguientes reglas:

### 1.1. El Cliente Interno "ASTILLERO"
Todos los trabajos, proyectos o consumos propios deben imputarse obligatoriamente a un cliente y barco ficticio denominado **"ASTILLERO"**. 
- Esta separación estructural asegura que los costos operativos internos nunca se mezclen accidentalmente en anexos de facturación comercial.
- Aplica para todo: desde OTs de mantenimiento continuo hasta OTs de proyectos internos (ej. "Construcción Galpón Nuevo") o trabajos de garantías cruzadas.

### 1.2. Agrupación Analítica Dinámica (Sin Nomenclatura Manual)
El sistema **no** requiere que el usuario agregue el año o período manualmente al nombre de la OT (ej. **NO** es necesario escribir "MANTENIMIENTO PREDIO - 2026").
- **Nombre estándar:** La OT se nombra de manera simple y constante a lo largo del tiempo (ej. "MANTENIMIENTO PREDIO").
- **Corte analítico automático:** Al consultar el *Comparador de Obras* o los reportes del módulo de Analítica, el sistema agrupa y separa los costos por año automáticamente leyendo la fecha real de la imputación (la fecha en que se cargaron las horas o los materiales). Esto permite comparar de forma nativa el costo anual de mantenimiento entre 2025, 2026 y 2027 sin ensuciar la base de datos con decenas de OTs duplicadas por calendario.
