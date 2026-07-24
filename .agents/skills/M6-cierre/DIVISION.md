# División: M6-cierre — Cierre y Archivo Histórico

## Responsabilidad
Data Locking, Auditoría, Archivo Histórico, Dashboards históricos.

## Entidades Principales
- ClosureLog (Cierre por OT)
- AuditTrail (Auditoría)
- HistoricalData (Archivo histórico)

## Reglas de Negocio Clave
- Cuando lote de OTs pasa a "Facturado", el sistema BLOQUEA esas OTs
- Rebota cualquier intento de carga posterior
- Ver: especificaciones del módulo en `docs/02_Especificacion/modulo_06_cierre.md`

## Skills en Esta División
[Se actualizará conforme se agreguen Skills]

## Módulos Dependientes
- M3-operaciones (cierre de OTs)
- M5-comercial (al facturar dispara el lock)

## Última Actualización
2026-07-23
