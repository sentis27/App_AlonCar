---
id: ERR-004
tipo: error
fase: 3
estado: borrador
fecha: 2026-11-12
---
# Pantalla en negro al asignar Buque y OT por hook condicional en modal picker

## Qué pasó
Al abrir el selector de Buque y OT en Terceros (doble clic o Enter en celda), toda la aplicación se desmontaba quedando en pantalla negra.

## Tiempo perdido
~30 minutos

## Por qué falló
En `app/src/components/ShipWorkOrderPickerModal.jsx`, se declaró `useMemo` (`selectedScope`) después del corte temprano `if (!isOpen) return null`. Al pasar `isOpen` de `false` a `true`, cambió la cantidad de hooks entre renders y React lanzó una excepción fatal no capturada (`Rendered more hooks than during the previous render`).

## Solución validada
1. Mover `selectedWo` y el cálculo de alcance (`useMemo`) por encima de `if (!isOpen) return null` para garantizar idéntico orden de hooks en todo render.
2. Normalizar comparación `String(wo.ship_id) === String(formData.ship_id)` en `app/src/components/terceros/TercerosModals.jsx`.
3. Validar con `npx oxlint --deny=rules-of-hooks` (0 errores) y `npm run build` (PASS).

## Cómo detectarlo rápido
Ejecutar `npx oxlint --deny=rules-of-hooks` antes de cada commit; cualquier hook debajo de un `return` condicional bloquea el linter inmediatamente.
