# ⚖️ Principio Rector: Clasificación Funcional Universal ("Gallo o Gallina")

> **Regla de Oro AlonCar:** Todo módulo, pantalla, subpantalla o vista presente o futura del sistema (sea Compras, Pañol, Terceros, Horas, o futuros como Cuenta Corriente, Facturación o Finanzas) se clasifica estrictamente por su **FUNCIÓN**, nunca por su nombre.
> **"O es Gallo o es Gallina, no hay opción."**

---

## 1. Los Dos Arquetipos del Sistema

```
                      ┌──────────────────────────────────────────────┐
                      │        VISTA O PANTALLA EN ALONCAR ERP       │
                      └──────────────────────┬───────────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
     ┌───────────────────────────────┐               ┌───────────────────────────────┐
     │  ARQUETIPO 1: TRANSACCIONAL   │               │     ARQUETIPO 2: ANALÍTICO    │
     │      (CARGA Y EDICIÓN)        │               │     (CONSULTA Y DECISIÓN)     │
     ├───────────────────────────────┤               ├───────────────────────────────┤
     │ • Requiere agregar datos      │               │ • Requiere visualizar datos   │
     │ • Requiere modificar celdas   │               │ • Requiere cruzar filtros     │
     │ • Requiere duplicar filas     │               │ • Requiere comparar períodos  │
     │ • Requiere formularios/altas  │               │ • Requiere auditar o conciliar│
     └───────────────────────────────┘               └───────────────────────────────┘
```

---

## 2. Arquetipo 1: Módulos de Carga y Edición de Datos (Transaccionales)
* **Criterio de Inclusión:** Si el usuario puede tipear, seleccionar opciones en celdas, agregar filas, borrar registros o importar datos (ejemplos actuales: *Compras, Pañol, Carga de Horas, Terceros*; ejemplos futuros: *Cuenta Corriente, Facturación, Adelantos, Partes Diarios*).
* **Contrato Obligatorio Inviolable:**
  1. **Arquitectura de 4 Zonas:** Con bordes de color laterales (`sky` en contexto, `amber` en radar de KPIs si aplica, `cyan` en toolbar, `emerald` en grilla).
  2. **Ribbon Superior de Grilla:** Badge verde esmeralda `[MODO PLANILLA]` con leyenda de atajos + botón `+ + Insertar Fila en #X` (arriba a la derecha) + memoria Undo.
  3. **Cabeceras Sticky (`thead`):** Indicador `✎` obligatorio en toda columna que admita edición (in-situ o por modal).
  4. **Los 3 Disparadores Canónicos:**
     - Doble clic en Buque/Destino ➔ `ShipWorkOrderPickerModal`
     - Doble clic en Contratista/Persona ➔ `ContractorPickerModal` (con regla dura: OT en blanco = padrón completo; OT asignada = filtrado por OT con fallback)
     - Clic en Lápiz (✏️) ➔ Modal integral de fila completa
  5. **Buscador Omnicanal:** Crawler profundo que indexa todas las propiedades del registro, adjuntos PDF y submenús (fletes, comprobantes).
  6. **Botonera Inferior de Inserción Rápida:** Botón `+ + nuevo [registro]` (borde dorado/ámbar).
  7. **Barra Inferior Flotante Estandarizada:**
     - Badge `[⚠️ Filtro Activo (X de Y)  [✕ Limpiar Todo]]`.
     - Motor matemático dinámico: Si el usuario selecciona celdas de texto con el mouse ➔ `RECUENTO: N celdas`. Si selecciona números ➔ `Σ SUMA: X  |  Ø PROM: Y`. Si no hay selección ➔ sumatorias y promedios globales del filtro activo.

---

## 3. Arquetipo 2: Módulos de Consulta, Análisis y Comparación (BI / Auditoría)
* **Criterio de Inclusión:** Si la pantalla está destinada a evaluar rentabilidad, comparar costos entre obras, auditar stock histórico, ver matrices quincenales o reportes gerenciales (ejemplos actuales: *Tablero de OTs, Resumen Gerencial, Comparador de Obras, Auditoría de Stock, Reconciliación de Costos*).
* **Contrato Obligatorio:**
  1. Gráficos, tarjetas ejecutivas o matrices comparativas de solo lectura.
  2. Sin celdas editables in-situ (sin `✎`, sin fill handle).
  3. Filtros analíticos globales por período, barco o contratista.
  4. Botones de exportación o informe ejecutivo (PDF/Excel).

---

## 4. Regla de Gobernanza para Nuevos Módulos
Cualquier nuevo módulo que se cree en el sistema debe declararse al inicio de su código:
```javascript
// ARQUETIPO: CARGA_DE_DATOS | ANALISIS_DE_DATOS
```
Si es `CARGA_DE_DATOS`, hereda automáticamente el 100% de los componentes y reglas del Arquetipo 1 sin inventar variaciones.
