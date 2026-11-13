---
id: ERR-005
tipo: error
fase: 3
estado: borrador
fecha: 2026-11-13
---
# Contenedor max-w-7xl y nuevas columnas recortan visualmente la columna Acciones en Personal y Tarifas

## Qué pasó
En `/personal` (Nómina de Operarios), el módulo mostraba bandas laterales vacías respecto al resto de las pantallas del ERP y la columna `Acciones` dejaba de verse dentro del área visible de la grilla.

## Por qué falló
1. El contenedor raíz de `app/src/pages/Personal.jsx` conservaba `max-w-7xl mx-auto` (1280px), a diferencia del estándar `w-full` usado en las demás grillas.
2. Al agregarse la columna `Contrato` y el ícono de ayuda en `Elem. Seg. ✎` (`68e9f50`) manteniendo paddings `px-3`/`px-2.5` sobre `14` columnas dentro de `max-w-7xl`, la tabla superó el ancho disponible y empujó `Acciones` fuera del scroll visible derecho.

## Solución aplicada
1. Reemplazar `max-w-7xl mx-auto` por `w-full` en `app/src/pages/Personal.jsx`.
2. Compactar paddings horizontales (`px-2` / `px-1.5`) en `thead` y `tbody` de `app/src/components/personal/PersonalNominaPanel.jsx` y fijar `whitespace-nowrap` en `Acciones`.
3. Verificar `oxlint` (`0` errores) y `npm run build` (`0` errores); pendiente confirmación visual autenticada en navegador (`estado: borrador`).
