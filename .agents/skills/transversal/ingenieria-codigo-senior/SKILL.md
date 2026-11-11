---
name: ingenieria-codigo-senior
description: Criterios de arquitectura, escritura de código limpio, separación de responsabilidades, diseño defensivo, modularidad y auditoría técnica con estándar de ingeniero senior. Aplica al escribir código nuevo, modificar código existente o auditar módulos.
---

# Ingeniería de Código Senior y Auditoría Técnica (SKL-009)

## Problema general que resuelve

> **El código que "funciona hoy" pero está acoplado, duplicado o sin manejo de fallas multiplica por diez el costo y los errores de cada cambio futuro.**

Un ingeniero senior optimiza para **lectura rápida, cambio aislado y falla controlada**, nunca para salir del paso.

---

## 0. Cuándo se activa

- **Modo Escritura:** siempre que se cree o modifique código (`.js`, `.jsx`, `.sql`, `.css`, `Dockerfile`, `.yml`).
- **Modo Auditoría:** cuando el usuario pida revisar, auditar, ordenar o detectar mejoras en un módulo o en el sistema.

---

## 1. Los 10 principios de ingeniería senior

### P1. Separación estricta de responsabilidades (Enfoque Crítico)
Ningún archivo ni función puede mezclar transporte/presentación, reglas de negocio y acceso a datos:
- **En Frontend:**
  1. `api/` o `services/`: comunicación HTTP o cliente de base de datos, sin JSX ni estados visuales.
  2. `lib/` o `utils/`: reglas de negocio, validadores, formateadores y cálculos como **funciones puras** (entra dato → sale resultado).
  3. `hooks/`: coordinación de estado, filtros, paginación y atajos.
  4. `pages/` y `components/`: estructura visual y disparo de acciones.
  > **🛑 Prohibición de Persistencia en Vista:** Queda terminantemente prohibido ejecutar `supabase.from().select/insert/update/delete` directamente dentro de callbacks de eventos o JSX en componentes visuales. Toda operación de base de datos debe residir en funciones de `lib/` o `services/`.
- **En Backend:**
  1. `routes/`: definición de rutas y middlewares de entrada.
  2. `controllers/`: lectura de `req` y emisión de código HTTP en `res`. Cero SQL/ORM.
  3. `services/`: reglas de negocio, permisos de dominio y coordinación de transacciones. No conoce `req` ni `res`.
  4. `repositories/` y `models/`: consultas SQL/ORM aisladas y serialización de salida (`toDTO`).

### P2. Una sola fuente de verdad (prohibido el estado duplicado)
- Todo valor que pueda derivarse de datos ya presentes en memoria (KPIs, totales, conteos, listas filtradas) **se calcula al vuelo (`useMemo` o selector puro) y nunca se duplica en otro `useState` o columna redundante**.
- **Cero Catálogos Hardcodeados:** Prohibido declarar arrays estáticos de datos maestros (nombres de operarios, rubros, roles, barcos, proveedores) en archivos locales `.js`/`.jsx`. Todo catálogo de negocio se consulta dinámicamente desde Supabase o desde el servicio unificado en `app/src/lib/`.
- Dos fuentes para el mismo dato garantizan desincronización.

### P3. Modularidad con criterio de cohesión
Ni archivos monolíticos de miles de líneas, ni fragmentación artificial en decenas de archivos diminutos:
- **La Regla de la "Caja Nueva":** Todo subpanel, pestaña adicional, modal o herramienta que supere ~150–200 líneas **NACE OBLIGATORIAMENTE en su propio archivo modular** dentro de `app/src/components/[modulo]/`. La página orquestadora solo debe importar el componente y montarlo en un bloque limpio de pocas líneas.
- **Regla de extracción obligatoria:** un bloque se extrae a su propio archivo cuando:
  1. Supera ~250–300 líneas y tiene una responsabilidad propia (un modal, una subtabla, un panel de configuración, un servicio).
  2. Su lógica aparece **2 o más veces** en el sistema.
  3. Es un cálculo o regla de negocio que puede probarse sin levantar la interfaz.

### P4. Contratos explícitos e inmutables entre piezas
- Antes de consumir o editar un componente, hook, servicio o endpoint compartido, **se lee su firma real en el código** (parámetros, props, valores por defecto y retorno). Prohibido adivinar nombres de props o campos.
- Las entradas y salidas tienen forma predecible; una función no devuelve a veces un objeto, a veces `null` y a veces un booleano.

### P5. Legibilidad en 30 segundos (código explícito)
- **Nombres con significado de negocio:** `activeWorkersWithoutPhone` en lugar de `arr2`; `calculateHourlyCostArs` en lugar de `calc`.
- **Cláusulas de guarda (retorno temprano):** validar precondiciones al inicio y cortar temprano en lugar de anidar `if / else` profundos.
- **Cero valores mágicos:** estados, límites, roles, puertos por defecto y colores semánticos viven en constantes con nombre.
- **Una función, un nivel de abstracción:** si una función valida, transforma, guarda y formatea, se divide.

### P6. Diseño defensivo y manejo explícito de fallas (Enfoque Crítico)
El código senior asume que la red falla, la base rechaza datos, el entorno está incompleto y el usuario hace doble clic:
- **Fail-Fast en configuración:** al iniciar, se validan todas las dependencias y variables de entorno obligatorias; si falta una, el proceso se detiene de inmediato con un mensaje exacto.
- **Tres estados obligatorios en operaciones asíncronas:** `cargando` (con bloqueo de doble envío), `éxito` y `error explícito` visible y accionable para el usuario. Prohibido el `catch (e) { console.error(e) }` que traga el error en silencio.
- **Acceso seguro a estructuras:** lectura defensiva (`?.`, `??`, valores por defecto) para que un dato nulo o incompleto nunca rompa el renderizado ni tumbe el proceso servidor.
- **Transaccionalidad:** toda operación que modifique más de una tabla o registro relacionado se ejecuta dentro de una transacción atómica (todo o nada).
- **Trazabilidad Inquebrantable (`auditService`):** Toda mutación de datos en grillas y formularios operativos invoca obligatoriamente `auditService.logCellChange()` o `auditService.logRowAction()`, garantizando persistencia en `audit_logs` con usuario real.
- **Blindaje Anti-Corrupción en Inputs (`onBlur`):** Todo manejador de pérdida de foco en celdas o formularios editables se declara estrictamente como `onBlur={() => commitFn()}` (función flecha sin argumentos), impidiendo terminantemente que el `FocusEvent` se envíe como valor a la base de datos produciendo `[object Object]`.
- **Errores tipados y centralizados:** las capas internas lanzan errores de dominio con código y causa (`AppError`); una única barrera de salida los traduce a respuesta HTTP o mensaje de interfaz sin filtrar trazas internas ni secretos en producción.

### P7. Regla del Boy Scout acotada
- Al tocar una función o componente, se limpia la deuda inmediata de ese bloque (imports sin usar, variables muertas, nombres ambiguos locales).
- **Límite inviolable:** nunca mezclar una refactorización estructural no solicitada dentro de un cambio funcional. Si se detecta deuda mayor en el archivo, se deja intacta y se reporta al final como hallazgo técnico.

### P8. Intervención quirúrgica en archivos existentes
- Prohibido aplicar reemplazos masivos a ciegas sobre archivos grandes.
- Siempre leer el contexto exacto alrededor de las líneas a modificar, realizar el cambio mínimo necesario y verificar el archivo resultante (`SKL-007 P3`).

### P9. Refactorización incremental sin regresión
Cuando se desarma un monolito existente, se hace en pasos donde cada paso compila y pasa `SKL-007`:
1. Extraer constantes y funciones puras (`lib/`).
2. Extraer subcomponentes y modales autónomos (`components/`).
3. Extraer acceso a datos y coordinación (`services/` y `hooks/`).
4. Simplificar la vista principal (`pages/`).

### P10. Simplicidad y economía de abstracción
No crear capas vacías, patrones complejos ni configuraciones para casos hipotéticos que el negocio no tiene. La mejor arquitectura es la más simple que cumple los 9 principios anteriores y soporta crecer 10x en datos y módulos.

---

## 2. Procedimiento en Modo Auditoría

Cuando el usuario pide auditar un módulo, una capa o el repositorio, no se edita código: se inspecciona contra `P1–P10` (más `SKL-007 P9–P10`) y se entrega esta matriz:

```markdown
### Diagnóstico Técnico Senior (SKL-009)

| Severidad | Hallazgo | Principio violado | Ubicación (`archivo:línea`) | Riesgo real para el negocio | Esfuerzo | Acción recomendada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CRÍTICA** | Puede corromper datos, perder información, exponer secretos o tumbar la app | P1–P10 | ... | ... | Bajo/Medio/Alto | ... |
| **ALTA** | Acoplamiento o duplicación que ya produce bugs o bloquea cambios | ... | ... | ... | ... | ... |
| **MEDIA** | Monolito o función difícil de mantener y probar | ... | ... | ... | ... | ... |
| **MEJORA** | Simplificación, limpieza o ajuste preventivo de escalabilidad | ... | ... | ... | ... | ... |
```
