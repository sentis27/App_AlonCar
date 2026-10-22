# DEC-018 — Tabulador Inteligente de Partes por Grupo, Gobernanza de IA y Puerta de Emergencia de Rubro

> **Estado:** Implementado / Aprobado
> **Fase:** 3 (Operaciones & Automatización Asistida)
> **Fecha:** 2026-10-22
> **Módulos Afectados:** M3 (Carga de Horas), M2 (Padrón de Personal), Panel Administrador (`/admin`)

---

## 1. Contexto y Problemática

En la operación del astillero, los partes diarios de trabajo se reciben frecuentemente por WhatsApp o audios transcritos de capataces con formato desestructurado (ej. *"Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación 5 hr en don Antonio bodega sacar porurietano y comentando"*). 

Anteriormente se consideraba utilizar n8n para este procesamiento, pero eso requería infraestructura externa y llamadas desincronizadas con la base de datos de la aplicación.

Por otro lado, existían tres problemas operativos recurrentes:
1. **Rigidez de oficios:** Un operario con oficio fijo de *Calderería* a veces hace *Soldadura* o un *Pintor* raschina. Se requería que el rubro saliera automáticamente por defecto, pero con una "puerta de emergencia" para cambios operativos sin alterar el padrón base.
2. **Multi-Rubro de contratistas:** Los contratistas externos pueden prestar múltiples servicios (ej. Calderería, Soldadura, Mecánica).
3. **Acceso a Prompts:** El administrador requería poder ajustar, auditar y versionar las instrucciones del sistema sin tocar código ni depender de programadores.

---

## 2. Decisiones Arquitectónicas Implementadas

### A. Motor Híbrido In-App (aiLaborEngine.js)
Se eliminó la dependencia externa de n8n para esta tarea. El procesamiento se integró nativamente en la aplicación web mediante un motor con respaldo continuo en 3 niveles:
- **Nivel 1:** Supabase Edge Function (`/functions/v1/parse-crew-message`) para llamadas seguras server-side.
- **Nivel 2:** Fallback directo a OpenAI API (`gpt-4o-mini`, temperatura `0.0`, formato JSON estricto).
- **Nivel 3:** Fallback a Parser Naval Determinístico Local (JavaScript en el navegador, costo \$0, funciona 100% offline).

### B. Reglas de Negocio del Procesamiento (SDD v3.0)
- **RN-03 (Multiplicación en Paralelo):** "Andrés y Diego 9h" se desdobla en 9 hs para Andrés y 9 hs para Diego.
- **RN-09 (Corrección Ortográfica Naval):** Normalización de jerga (`reguillas` ➔ `rejillas`, `cuvierta` ➔ `cubierta`, `trancalin` ➔ `trancalín`, `porurietano` ➔ `poliuretano`).
- **E5/E6 (Prioridad a la División de Tareas):** Las subtareas de un mismo operario en barcos u OTs distintas se mantienen divididas para preservar el costeo exacto, con opción manual de consolidar.
- **Resolución de Homónimos:** Aviso interactivo con selección de apellido en 1 clic.

### C. Puerta de Emergencia de Rubro (`🔓 Ajustar`)
- **Astillero:** Al seleccionar un operario, carga automáticamente su rubro titular del padrón. Con el botón `🔓 Ajustar`, el operador puede cambiar temporalmente el rubro del día a cualquier especialidad oficial. Si el rubro difiere del titular, la fila muestra la etiqueta `🔄 Préstamo: Titular ➔ Rubro del Día`.
- **Habilitación Abierta Astillero:** Al habilitar cualquier `ASTILLERO.<RUBRO>` en una OT, se habilita a todo el personal del astillero, ordenando primero a los titulares de la especialidad y luego al resto del personal para préstamos operativos.
- **Contratistas Multi-Rubro:** Los contratistas pueden tener múltiples rubros en el padrón (`⭐ Principal` + secundarios) seleccionables en la grilla.

### D. Gobernanza de IA y Prompts en Supabase (Migración 0017)
- Creación de las tablas `public.system_prompts` y `public.ai_processing_logs` en Supabase PostgreSQL.
- Pestaña **`🧠 Gobernanza IA & Prompts`** en `/admin`:
  - Selector de proveedor (Híbrido, OpenAI, Local).
  - Editor y versionador de los 4 prompts del sistema (`router_clasificador_e3a`, `prompt_astillero`, `prompt_contratistas`, `diccionario_jerga_naval`).
  - Sandbox de pruebas sin persistencia de horas.
  - Bitácora de auditoría inmutable con registro de fecha, usuario, motor, versión y tokens consumidos.

---

## 3. Tareas Pendientes Asociadas

1. **[Pendiente Usuario]** Rotar la API Key de OpenAI en `platform.openai.com` y configurar el límite mensual de gasto (\$5-\$10 USD).
2. **[Pendiente Despliegue]** Desplegar la Edge Function `supabase/functions/parse-crew-message` mediante Supabase CLI.
3. **[Pendiente Módulos]** Replicar el sistema de Habilitación y Filtro en Cascada en los módulos de Materiales y Terceros.
