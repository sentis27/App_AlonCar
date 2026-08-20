# GS-006 — COMPRAS: Planilla de Registro de Compras

> **Módulo:** M4b — Logística / Compras  
> **Estado:** ✅ Confirmado (Escaneo Profundo)  
> **Spreadsheet ID:** `1k1BBl1pAf8HlGfiNzSt5xGHpkgQw1dD3tWERTYhu3MY`  
> **Última revisión:** 2026-08-20  

---

## 1. Visión General

La planilla de compras es la **puerta de entrada de insumos al astillero**. Cumple funciones críticas:

1. **Registro diario de pedidos de compra** — materiales, cantidades, proveedores, estados
2. **Alimentación del stock** — los materiales recibidos incrementan el inventario (física o virtualmente)
3. **Comparación de precios** — contrasta precio ofrecido por proveedor vs. precio registrado en sistema
4. **Ingreso de materiales nuevos** — materiales sin registro disparan alertas para alta en B.D. Materiales
5. **Estadísticas de proveedores** — frecuencia de compra, rubros, historial de precios
6. **Derivación a costo directo** — materiales comprados para una obra específica se imputan al costo vivo de la OT

---

## 2. Estructura de Hojas

| # | Hoja | GID | Filas | Cols | Rol |
|---|------|-----|-------|------|-----|
| 0 | **ALERTAS** | 262385685 | 26 | 8 | Dashboard de alertas derivadas de COMPRAS (cols AA→AF) |
| 1 | **INDICE** | 979441019 | 16 | 6 | Tablas técnicas de conversión para el encargado de compras |
| 2 | **COMPRAS** | 1198797698 | 40+ | 32 | 🔴 **Hoja principal** — registro diario de compras |
| 3 | **FILTER.CARGA.DIRECTA** | 1342067662 | 9 | 20 | Filtro intermedio de líneas marcadas como "DIRECTO" |
| 4 | **PROVEEDORES** | 1817551402 | 500+ | 9 | Catálogo de proveedores con datos de pago y contacto |
| 5 | **B.D.IMPORTADA** | 794448610 | 239 | 45 | Base importada de OTs, barcos, proveedores y personal autorizado |
| 6 | **B.D MATERIALES** | 995033070 | 500+ | 9 | Base de datos maestra de materiales con precios |

---

## 3. Hoja COMPRAS — Estructura de Columnas

### 3.1 Zona de Resumen (Filas 1-2)

```
Fila 1: [K] COTIZACIONES PENDIENTES: 0    [T] PEDIDOS PENDIENTES: 0
Fila 2: [K] EN REVISION: 0                [T] PEDIDOS INCOMPLETOS: 0    [Z] Fecha actual: 19/8/2026
```

Contadores automáticos calculados con COUNTIF sobre la columna W (Estado del Pedido).

### 3.2 Encabezados (Fila 3) — 32 Columnas

| Col | Letra | Encabezado | Tipo | Descripción |
|-----|-------|------------|------|-------------|
| A | A | **CARGA DIRECTA** | Dropdown | Destino del material: `DIRECTO`, `STN_BY`, `POR PAÑOL`, vacío |
| B | B | **FECHA** | Fecha | Fecha de carga del pedido |
| C | C | **CLIENTE** | Dropdown | Barco/embarcación (desde B.D.IMPORTADA) |
| D | D | **ORDEN TRABAJO** | Dropdown | OT asociada al barco seleccionado (desde B.D.IMPORTADA) |
| E | E | **SOLICITA** | Dropdown | Persona que solicita la compra (desde B.D.IMPORTADA, col "SOLICITA") |
| F | F | **TIPO DE TRABAJO** | Dropdown | Ej: `MATERIALES` |
| G | G | **NORMALES** | — | *(Heredada, sin uso)* |
| H | H | **HORAS AL 50%** | — | *(Heredada, sin uso)* |
| I | I | **HORAS AL 100%** | — | *(Heredada, sin uso)* |
| J | J | **RUBRO** | Dropdown | Rubro del material (desde B.D MATERIALES, col "RUBRO") |
| K | K | **MATERIALE** | Texto/Dropdown | Material a comprar (búsqueda en B.D MATERIALES) |
| L | L | **CANTID** | Número | Cantidad solicitada |
| M | M | **PRECIO/UNI** | Moneda | *(Heredada/sin uso actual)* |
| N | N | **$/U PROVEEDOR** | Moneda/Texto | Precio cotizado por el proveedor (carga manual) |
| O | O | **PESO** | — | *(Heredada, sin uso)* |
| P | P | **CENTRO DE COSTO** | — | *(Heredada, sin uso)* |
| Q | Q | **CATEGORIA** | — | *(Heredada, sin uso)* |
| R | R | **TIPO DE COMPROBANTE** | — | *(Heredada, sin uso)* |
| S | S | **$/U SISTEMA** | Moneda | 🔵 **Fórmula automática** — trae precio de B.D MATERIALES |
| T | T | **PROVEEDOR** | Dropdown | Proveedor seleccionado (desde hoja PROVEEDORES o B.D.IMPORTADA) |
| U | U | **MARCA TEMPORAL** | — | *(Sin uso visible)* |
| V | V | **ENTREGA ESTIMADA** | Fecha | Fecha estimada de entrega |
| W | W | **ESTADO DEL PEDIDO** | Dropdown | Estado actual del pedido (ver sección 3.3) |
| X | X | **CONDICION STOCK** | Dropdown | `STOCK`, `VIRTUAL`, `FALTA INFO` |
| Y | Y | **TIPO.IMPUTACION** | Texto | `PAÑOL`, `DIRECTO` — tipo de imputación |
| Z | Z | **OBSERVACIONES** | Texto libre | Notas del operario/supervisor |
| AA | AA | **DIFERENCIA DE DIAS** | Número | Fórmula: `FECHA_ACTUAL - FECHA_CARGA` (en días) |
| AB | AB | **COTIZACION.VENCIDAS** | Texto | `BIEN`, `VENCIDA`, etc. — estado de vigencia de cotización |
| AC | AC | **TRABAJ. ESPECIAL** | Texto | `N/C` (No corresponde) u otro valor |
| AD | AD | **FALTA CARGA DIRECTA** | Texto | `OK`, `ERROR` — alerta si falta cargar en costo directo |
| AE | AE | **COMPRA DIR. C/RECIBIDO** | Texto | `OK` — compra directa con estado recibido |
| AF | AF | **MATERIAL S/REG./B.DATOS** | Texto | `ok`, `error`, `NO ES NECESARIO` — 🔴 alerta de material sin registro en B.D |

### 3.3 Dropdown: ESTADO DEL PEDIDO (Col W)

| Valor | Significado | Acción / Efecto | Conservar |
|-------|-------------|------------------|-----------|
| `RECIBIDO` | Material recibido en depósito | ✅ Suma al stock físico | ✅ |
| `RECIBIDO 2` | Recibido pero NO computa stock | Material de cliente (ej: panela) | ✅ |
| `RECIB.COMP.DIRECT` | Recibido como compra directa | Se imputa al costo del barco, NO suma stock | ✅ |
| `PEDIDO` | Material pedido al proveedor | Estado normal post-aprobación | ✅ |
| `PEDIDO INCOMPLETO` | Llegó cantidad parcial | Requiere observaciones de lo faltante | ✅ |
| `PEDIR` | Alerta: material listo para pedir | Dispara al encargado de compras | ✅ |
| `COTIZACION` | Se solicita cotización antes de comprar | Supervisor pide comparar precios | ✅ |
| `COTIZAR` | Supervisor pide cotización para evaluar | Similar a COTIZACION | ✅ |
| `COTIZA.SOLICITUD` | Cotización pedida al proveedor, esperando respuesta | En espera | ✅ |
| `COTIZA.APROBADA` | Cotización aprobada | Puede proceder a pedido | ✅ |
| `COTIZA.RECHAZADA` | Cotización rechazada | Buscar alternativa | ✅ |
| `DEVOLUCION` | Material devuelto | — | ✅ |
| `ENVIADO` | Devolución en tránsito | — | ✅ |
| `CANCELADOS` | Compra cancelada | Ya no se requiere | ✅ |
| `SE COMPRA?` | Duda / en averiguación | Pedido posiblemente innecesario | ✅ |
| `NO VENDEN` | Proveedor no vende este producto | Estadística negativa del proveedor | ✅ |
| `3RO.RETIRAR` | Un tercero retira el material | ❌ **No se usa** | ❌ Eliminar |
| `EN REVISION` | En proceso de revisión | ❌ **Duplica "SE COMPRA?"** | ❌ Eliminar |

### 3.4 Dropdown: CARGA DIRECTA (Col A)

| Valor | Significado | Flujo |
|-------|-------------|-------|
| *(vacío)* | Compra estándar para stock/pañol | Material → Stock → Retiro por pañol |
| `DIRECTO` | Compra directa para una obra | Material → Costo directo del barco (no pasa por stock) |
| `STN_BY` | Stand-by en depósito | Material en depósito, requiere autorización para entrega. Luego pasa a DIRECTO o POR PAÑOL |
| `POR PAÑOL` | Se carga por planilla de materiales | Ítems agrupados (ej: "materiales eléctricos varios") con costo manual editado en pañol |

### 3.5 Dropdown: CONDICION STOCK (Col X)

| Valor | Significado |
|-------|-------------|
| `STOCK` | Material computado como stock físico real |
| `VIRTUAL` | Material pedido, aún no recibido — stock virtual (pendiente de recepción) |
| `FALTA INFO` | Información incompleta para clasificar |

---

## 4. Hoja ALERTAS — Dashboard de Compras

Panel de alertas automáticas derivadas de las columnas AA→AF de COMPRAS:

| Alerta | Contador | Origen |
|--------|----------|--------|
| **COMPRAS SIN RECIBIR** | 7 | Filas donde Estado ≠ RECIBIDO y hay pedido activo |
| **COTIZACIONES SIN APROBAR** | 0 | Estado = COTIZACION sin resolución |
| **COTIZACIONES APROBADAS** | 0 | Estado = COTIZA.APROBADA pendientes de pedido |
| **COTIZA. PEDIDAS A PROVEEDORES** | 0 | Estado = COTIZA.SOLICITUD |
| **COTIZACIONES MÁS DE 1 SEMANA** | 0 | Diferencia de días (col AA) > 7 y estado cotización |
| **COTIZACIONES VENCIDAS** | 0 | Col AB = VENCIDA |
| **TRABAJOS EN FABRICACION** | 0 | AC = trabajo especial activo |
| **FALTA CARGA DIRECTA** | 1 | Col AD = ERROR (compra directa sin cargar en costo) |
| **COMPRA DIRECTA CON RECIBIDO** | 0 | Col AE control |
| **MATERIAL S/REG./B.DATOS** | 6 | 🔴 Col AF = "error" → materiales nuevos sin alta en base de datos |
| **COTIZACIONES RECHAZADAS** | 0 | Estado = COTIZA.RECHAZADA |

> [!IMPORTANT]
> La alerta **MATERIAL S/REG./B.DATOS = 6** indica que hay 6 materiales escritos en la hoja COMPRAS que no existen en la B.D MATERIALES. Estos requieren alta manual.

---

## 5. Hoja FILTER.CARGA.DIRECTA

**Propósito:** Filtro intermedio que extrae las líneas de COMPRAS marcadas como `DIRECTO` para exportarlas a la planilla de costos de obra.

### Estructura (20 columnas):

| Col | Encabezado | Origen |
|-----|------------|--------|
| A | COSTO.DIRECTO | Col A COMPRAS |
| B | FECHA | Col B |
| C | CLIENTE | Col C |
| D | ORDEN DE TRABAJO | Col D |
| E | CONTRATISTA | Col E (SOLICITA) |
| F | TIPO DE TRABAJO | Col F |
| G-I | GRUPO/HORAS 50%/100% | Heredados |
| J | RUBRO | Col J |
| K | MATERILAES *(sic)* | Col K |
| L | CANTIDAD | Col L |
| M | PRECIO/UNI US$ | Conversión AR$ → US$ del precio sistema |
| N | COSTO TOTAL US$ | CANTIDAD × PRECIO/UNI US$ |
| O | PESO | — |
| P | CENTRO DE COSTO | Siempre "CLIENTE" |
| Q | CATEGORIA | Siempre "MATERIALES" |
| R | TIPO DE COMPROBANTE | — |
| S | NºFACTURA | — |
| T | OBSERVACIONES | Col Z COMPRAS |

> [!NOTE]
> Esta hoja es un **paso intermedio** que no debería existir en el sistema nuevo. La lógica de filtrado se automatiza directamente.

**Datos actuales:** 8 líneas de compra directa (mayo 2026), incluyendo materiales para barcos ARTESANAL 9 y DON VICENTE VUOSO.

---

## 6. Hoja PROVEEDORES

### Estructura (9 columnas principales + columnas auxiliares)

| Col | Encabezado | Tipo | Valores posibles |
|-----|------------|------|-----------------|
| A | **PROVEEDOR** | Texto | Nombre del proveedor |
| B | **RUBRO** | Texto | *(Incompleto — pendiente de carga)* |
| C | **FACTURACION TARDIA** | Texto | `ALERTA`, vacío |
| D | **MANERA DE PAGO** | Dropdown | `CONTADO`, `CUENTA CORRIENTE` |
| E | **MANERA DE CONTACTO** | Texto | *(Pendiente de carga)* |
| F | **MOMENTO DE FACTURACION** | Dropdown | `DIA`, `INICIO DE MES`, `ALEATORIO` |
| G | **MEDIO DE FACTURACION** | Dropdown | `E-MAIL`, `WHATSAPP`, `EN MANO` |
| H | **OBSERVACIONES** | Texto | Ej: "Transferencia", "PAGO A 7 DIAS", "SIN FACTURA" |
| I | **CONTACTO** | Texto | Datos de contacto |

**Datos actuales:** ~200+ proveedores registrados. Muchos tienen datos parciales (solo nombre). 

> [!WARNING]
> Faltan campos críticos para el sistema nuevo:
> - **RUBRO** está mayoritariamente vacío
> - **MANERA DE CONTACTO** está vacío
> - **CONTACTO** está vacío en la mayoría
> - No existe campo de **CBU/Alias** ni **CUIT/CUIL**

### Columnas auxiliares (cols K-N)
A partir de la columna K hay lo que parece ser una segunda tabla con otros proveedores y productos específicos (ej: bandas modulares, piñones). Esta data está **mezclada** con la tabla principal.

---

## 7. Hoja B.D MATERIALES

### Estructura (9 columnas + columna auxiliar de rubros)

| Col | Encabezado | Tipo | Ejemplo |
|-----|------------|------|---------|
| A | **MATERIALES** | Texto | "ABRAZADERA 1/4x3/4 C/ACCESORIO" |
| B | **COSTO AR$** | Moneda | "$531,12" |
| C | **% SEGURIDAD** | Número | "1,06" (factor multiplicador) |
| D | **COSTO US$** | Moneda | "$0,35" |
| E | **CATEGORIA** | Texto | `MATERIALES`, `CONSUMIBLES`, `ELEM_SEGURIDAD` |
| F | **LOCACION** | Texto | "PAÑOL" o vacío |
| G | **PESO** | Número | Peso en kg (mayormente vacío) |
| H | **RUBRO** | Texto | "ABRAZADERA", "ACCESORIOS", "RODAMIENTOS", etc. |
| I | **MARCA TEMPORAL** | Fecha | "28/5/2025 14:49:54" |

**Parámetros de conversión (Fila 3):**
- Factor de seguridad default: `1,06`
- Tipo de cambio AR$/US$: `$1.500`
- Link: `VER VALOR DOLAR BANCO NACION`

**Columna M (auxiliar): Lista de RUBROS para dropdown en COMPRAS**

Rubros identificados: `RODAMIENTOS`, `INS.MECANICA`, `ABRAZADERA`, `ACCESORIOS`, `ACEITES`, `LIMPIEZA`, `ELECTRICIDAD`, `ACOPLE/ADAPTADOR`, `MOTOR`, `ACC.HIDRAULICA`, `VIDRIOS`, `PINTURA`, `HERRAMIENTAS`, `PEGAMENTO`, `OTROS`, `ACC. PINTURA`, `JUNTAS`, `ACC. ALBAÑILERIA`, `ELECTRODOS`, `ALBAÑILERIA`, `BULONES`, `PERFILES ALUMINIO`, `ANGULOS`, `EQUIPO ESPECIAL`, `ELEM. SEGURIDAD`, `ARANDELAS`, `GASES`, `ACC. CINTAS PESCA`, `MACIZO`, `MADERA`, `HERRAJES`, `FABRICACION`, `BUJE`, `BOMBAS`, `TERMOFUSION`, `BRIDAS`, `BRONCE`, `REDUCCION`, `BURLETES`, `CADENAS`, `GRIFERIA`, `CAÑO`, `CAÑO COBRE`, `CAÑO PVC`, `CAÑO INOX`

**Volumen:** 500+ materiales registrados con precios actualizados (último timestamp: mayo-junio 2025).

---

## 8. Hoja B.D.IMPORTADA

Hoja de datos maestros importados del sistema central. Estructura en **columnas paralelas** (no tabla convencional):

| Columnas | Contenido |
|----------|-----------|
| A→AO (cols 1-41) | **Barcos/Clientes** (41 embarcaciones) con sus respectivas OTs listadas en filas debajo |
| AQ (col 43) | **PROVEEDORES** — lista de proveedores habilitados para dropdown |
| AR (col 44) | **RUBRO** — rubro de cada proveedor |
| AS (col 45) | **SOLICITA** — personas autorizadas a solicitar compras |
| AT (col 46) | **PERSONAL PARA LISTA DE TRABAJOS** — personal para asignación |

### Barcos registrados (41):
`ASTILLERO`, `SAGRARIO`, `MARINA Z`, `REMOLCADOR EDIMIR`, `ARTESANAL 7`, `INCOBRABLES`, `GIULIANA`, `TRITON I`, `ROSA MISTICA`, `DON VICENTE VUOSO`, `SKIPPER`, `SAN CAYETANO`, `RODA`, `CODASTE`, `VIERASA XVII`, `MAR DE ORO`, `REMOLCADOR DUMAR`, `ALTAR`, `RUA DON JOSE`, `LANCHA`, `SILVIA YOLANDA`, `ARESIT`, `KONA`, `CALIZ`, `PESQ. DESEADO`, `ARTESANAL 9`, `ARTESANAL 8`, `ERIN BRUCE`, `PANTOGRAFO`, `DARSENA`, `OPEN SEA`, `RIBAZON INES`, `VIENTO NORTE`, `MAR AUSTRAL`, `REMOLCADOR HURACAN`, `MIRIAM`, `TABEIRON`, `LOBO`, `MANUMAR`, `WIRON`, `CONARA I`

### Proveedores de B.D.IMPORTADA (muestra):
~200 proveedores con rubro asignado (ej: `ALFAMETAL de Hector Orlando Jano → MATERIALES`, `ALON CAR SA → MANUAL`, `CHARRA → CALDERERIA`)

### Personal autorizado a solicitar compras (muestra):
`MANUEL`, `LUIS M`, `ALDO`, `ALBERTO GONZALEZ`, `HUGO`, `ALE CAMADELLI`, `JORGE`, `MARTIN`, `OMAR`, `PABLO N.`, `ROBERTO`, `PAÑOL`, `X(JUSTIFICAR)`, `FABRICACION`, `SABRINA`, `TORNERIA`, y 30+ más.

---

## 9. Hoja INDICE

**Propósito:** Tablas de referencia técnica para el encargado de compras.

| Sección | Contenido |
|---------|-----------|
| **REGISTROS** | Link a bitácora de clientes |
| **TABLAS TÉCNICAS** | Chapas, Tubos ASTM, Macizos, Ángulos, Tabla mm↔pulgadas, Planchuelas, Cadenas c/contrete, Macizos cuadrados, Perfil UPN, Estructuras cuadradas/rectangulares, Chapa galvanizada, Presión tubos ASTM, Tubos inoxidable, Especificaciones técnicas bridas |

> [!NOTE]
> Esta hoja no se accede hace mucho tiempo. Se puede considerar como **información de referencia legacy**. En el sistema nuevo, las tablas técnicas podrían estar en una sección de documentación/ayuda.

---

## 10. Fórmulas y Lógica Clave

### 10.1 Precio del Sistema (Col S)
```
=BUSCARV(K4, 'B.D MATERIALES'!A:B, 2, FALSO)
```
Busca el material en la columna A de B.D MATERIALES y trae el COSTO AR$ (col B). Si no encuentra el material → devuelve error → se marca en col AF como `error`.

### 10.2 Diferencia de Días (Col AA)
```
=HOY() - B4
```
Calcula días transcurridos desde la fecha de carga. Útil para vigencia de cotizaciones.

### 10.3 Cotización Vencida (Col AB)
Lógica condicional:
- Si Estado = COTIZA.* y Diferencia > 7 días → `VENCIDA`
- Si Estado = COTIZA.* y Diferencia ≤ 7 → `BIEN`
- Si no aplica → `N/C`

### 10.4 Material sin Registro (Col AF)
```
=SI(ESERROR(S4), "error", "ok")
```
Si la fórmula BUSCARV en col S falla → el material no existe en B.D MATERIALES → `error`.

### 10.5 Falta Carga Directa (Col AD)
Lógica: Si col A = "DIRECTO" y no se ha cargado en la planilla de costos directos → `ERROR`.

### 10.6 Contadores del Resumen (Filas 1-2)
```
COTIZACIONES PENDIENTES = CONTAR.SI(W:W, "COTIZACION") + CONTAR.SI(W:W, "COTIZAR")
PEDIDOS PENDIENTES = CONTAR.SI(W:W, "PEDIDO") + CONTAR.SI(W:W, "PEDIR")
EN REVISION = CONTAR.SI(W:W, "SE COMPRA?") + CONTAR.SI(W:W, "EN REVISION")
PEDIDOS INCOMPLETOS = CONTAR.SI(W:W, "PEDIDO INCOMPLETO")
```

---

## 11. Flujo de Trabajo Operativo

```mermaid
flowchart TD
    A[Operario solicita material] --> B{Material existe en B.D?}
    B -- Sí --> C[Selecciona material del dropdown]
    B -- No --> D[🔴 Escribe material manualmente]
    D --> E[Col AF = error / Alerta en ALERTAS]
    E --> F[Supervisor da alta en B.D MATERIALES]
    
    C --> G[Carga proveedor, cantidad, precio]
    F --> G
    
    G --> H[Estado = PEDIR]
    H --> I{Supervisor evalúa}
    I -- Precio alto --> J[Estado = COTIZAR/COTIZACION]
    J --> K[Se pide cotización al proveedor]
    K --> L{Respuesta}
    L -- Aprobada --> M[Estado = COTIZA.APROBADA]
    L -- Rechazada --> N[Estado = COTIZA.RECHAZADA]
    M --> O[Estado = PEDIDO]
    
    I -- Precio OK --> O
    
    O --> P{Recepción}
    P -- Completo --> Q{¿Tipo de carga?}
    P -- Parcial --> R[Estado = PEDIDO INCOMPLETO]
    
    Q -- Vacío/PAÑOL --> S[Estado = RECIBIDO → Suma a Stock]
    Q -- DIRECTO --> T[Estado = RECIB.COMP.DIRECT → Costo del barco]
    Q -- POR PAÑOL --> U[Carga manual en planilla materiales]
    Q -- STN_BY --> V[Depósito con autorización pendiente]
    V --> Q
```

---

## 12. Problemas Identificados y Soluciones Propuestas

### 12.1 🔴 Alta de Materiales Nuevos (CRÍTICO)

**Problema:** Cuando un material no existe en B.D MATERIALES, el operario lo escribe manualmente. El supervisor luego identifica estos materiales (triángulo rojo en Google Sheets) y los copia/pega manualmente a la B.D. Es un proceso tedioso y propenso a errores.

**Solución propuesta:**
1. Al escribir un material que no se encuentra en la B.D → mostrar botón/ícono para **"Crear material nuevo"**
2. Se abre un formulario inline con campos: nombre, rubro, categoría, costo estimado, peso
3. El supervisor puede editar y aprobar el alta → se agrega automáticamente a la tabla `materials`
4. El campo de la compra se vincula al material recién creado

### 12.2 🟡 Comparación de Precios (MEJORA)

**Problema:** La columna N ($/U Proveedor) permite comparar con col S ($/U Sistema), pero no hay información de:
- % de variación (aumento/disminución)
- Fecha de última actualización del precio en sistema

**Solución propuesta:**
- Agregar un indicador visual automático: ⬆️ +15% | ⬇️ -5%
- Mostrar la fecha de `MARCA TEMPORAL` del material consultado
- Histórico de precios por material

### 12.3 🟡 Ítems "POR PAÑOL" con Costo Manual

**Problema:** Ítems agrupados (ej: "materiales eléctricos varios") se cargan con costo $0 en la B.D. y el supervisor edita manualmente el precio en la planilla de materiales.

**Solución propuesta:**
- Permitir edición in situ del costo unitario cuando se selecciona la opción `POR PAÑOL`
- Cambiar el flujo: el supervisor carga el costo real → se convierte en `DIRECTO` → entra al sistema normalmente

### 12.4 🟡 Columnas Heredadas sin Uso

**Columnas a eliminar:** G (NORMALES), H (HORAS AL 50%), I (HORAS AL 100%), M (PRECIO/UNI redundante), O (PESO), P (CENTRO DE COSTO), Q (CATEGORIA), R (TIPO DE COMPROBANTE)

**Total columnas útiles:** 32 → **24 columnas** (reducción del 25%)

### 12.5 🟡 Permisos de Solicitud

**Pendiente:** Agregar un nuevo permiso en B.D.NewSystem para que un proveedor pueda solicitar materiales en compras (nuevo flag `enabled_purchase_request`).

---

## 13. Datos Muestra (Hoja COMPRAS — Mayo 2026)

| Fecha | Cliente | OT | Material | Cant | $/U Sistema | Proveedor | Estado | Carga |
|-------|---------|-----|----------|------|-------------|-----------|--------|-------|
| 15/05 | ASTILLERO | STOCK | GAS TUBO X 45KG | 2 | $114.510 | ATLANTICA GAS | RECIBIDO | — |
| 18/05 | ARTESANAL 9 | SALA MAQ | TUERCA AUTOFR 1/2 | 2 | $0 | FERREMAT | RECIB.COMP.DIRECT | DIRECTO |
| 19/05 | ARTESANAL 9 | CUBIERTA | ARENA X MT BOLSON | 1 | $39.644 | CASA CARLITOS | RECIB.COMP.DIRECT | DIRECTO |
| 19/05 | ASTILLERO | STOCK | BATERIA DE OXIGENO | 3 | $814.000 | AIR LIQUIDE | RECIBIDO | — |
| 20/05 | DON V. VUOSO | ADIC. LINEA EJE | BUJE BRONCE POLIURETANO | 0,46 | $3.373.715 | LOTTERI HNOS | PEDIDO | DIRECTO |
| 21/05 | ARTESANAL 9 | ELECTRICIDAD | MAT. ELECTRICOS VARIOS | 1 | $488.554 | CIARDI | PEDIDO | POR PAÑOL |

---

## 14. Mapeo a Entidades del Sistema Nuevo

### Tabla `purchase_orders`

| Campo Sistema | Origen en Sheets | Notas |
|--------------|------------------|-------|
| `id` | Autogenerado | UUID |
| `charge_type` | Col A (CARGA DIRECTA) | ENUM: `DIRECT`, `STANDBY`, `VIA_PANOL`, `STOCK` |
| `order_date` | Col B (FECHA) | DATE |
| `ship_id` | Col C → `ships.id` | FK |
| `work_order_id` | Col D → `work_orders.id` | FK |
| `requested_by` | Col E → `workers.id` o texto | FK o texto libre |
| `work_type` | Col F | ENUM o texto |
| `material_id` | Col K → `materials.id` | FK (nullable si material nuevo) |
| `material_name_raw` | Col K | Texto original ingresado |
| `quantity` | Col L | DECIMAL |
| `supplier_quoted_price` | Col N | DECIMAL (nullable) |
| `system_unit_price` | Col S | DECIMAL (calculado de materials) |
| `supplier_id` | Col T → `suppliers.id` | FK |
| `estimated_delivery` | Col V | DATE (nullable) |
| `status` | Col W | ENUM (ver sección 3.3) |
| `stock_condition` | Col X | ENUM: `PHYSICAL`, `VIRTUAL`, `MISSING_INFO` |
| `charge_destination` | Col Y | ENUM: `PANOL`, `DIRECT` |
| `observations` | Col Z | TEXT |
| `days_elapsed` | Calculado | INTEGER (server-side) |
| `quote_status` | Col AB | ENUM: `OK`, `EXPIRED`, `NA` |
| `is_new_material` | Col AF | BOOLEAN (derivado de "error") |

### Tabla `suppliers` (ampliada desde PROVEEDORES)

| Campo Sistema | Origen en Sheets | Notas |
|--------------|------------------|-------|
| `id` | Autogenerado | UUID |
| `name` | Col A | TEXT UNIQUE |
| `trade` | Col B (RUBRO) | TEXT o FK a tabla trades |
| `late_billing_alert` | Col C | BOOLEAN |
| `payment_method` | Col D | ENUM: `CASH`, `CREDIT_ACCOUNT` |
| `contact_method` | Col E | ENUM: `EMAIL`, `WHATSAPP`, `PHONE`, `IN_PERSON` |
| `billing_timing` | Col F | ENUM: `SAME_DAY`, `MONTH_START`, `RANDOM` |
| `billing_medium` | Col G | ENUM: `EMAIL`, `WHATSAPP`, `IN_PERSON` |
| `observations` | Col H | TEXT |
| `contact_info` | Col I | TEXT |
| `enabled_purchases` | Nuevo | BOOLEAN — habilitado como proveedor de compras |
| `enabled_third_party` | Existente | BOOLEAN |
| `enabled_hours` | Existente | BOOLEAN |
| `enabled_materials` | Existente | BOOLEAN |

---

## 15. Dependencias con Otras Planillas

```mermaid
graph LR
    COMPRAS -->|"Col S: BUSCARV precio"| BD_MAT["B.D MATERIALES<br/>(GS-002)"]
    COMPRAS -->|"Col C,D,E: Barcos/OTs/Personal"| BD_IMP["B.D.IMPORTADA<br/>(B.D.NewSystem)"]
    COMPRAS -->|"Col T: Lista proveedores"| PROV["PROVEEDORES"]
    COMPRAS -->|"Filtro DIRECTO"| FILTER["FILTER.CARGA.DIRECTA"]
    FILTER -->|"Exporta a"| COSTO_OBRA["Planilla Costo Obra<br/>(externa)"]
    COMPRAS -->|"Estado RECIBIDO"| STOCK["CONTROL DE STOCK<br/>(pendiente escaneo)"]
    COMPRAS -->|"Alertas AA-AF"| ALERTAS["ALERTAS"]
    BD_MAT -->|"Catálogo materiales"| PANOL["Planilla Materiales/Pañol<br/>(GS-002)"]
```

---

## 16. Preguntas Abiertas

> [!IMPORTANT]
> 1. **Control de Stock:** La planilla de CONTROL DE STOCK está pendiente de escaneo. ¿Cuándo la abordamos?
> 2. **Proveedores duplicados:** Hay proveedores en PROVEEDORES y también en B.D.IMPORTADA. ¿Se unifican en una sola tabla `suppliers`?
> 3. **Tipo de cambio:** B.D MATERIALES usa un tipo de cambio fijo ($1.500). ¿Se actualiza manualmente o se automatiza con cotización del Banco Nación?
> 4. **Historial de precios:** ¿Se necesita un log de cambios de precios por material? (Útil para la comparación del punto 12.2)
> 5. **POR PAÑOL con costo $0:** ¿Aprobás la solución propuesta de edición in situ + conversión a DIRECTO?
