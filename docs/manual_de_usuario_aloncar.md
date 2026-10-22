# 📘 Manual de Uso Operativo y Guía Técnica del Sistema — Astillero Alon Car

Este documento constituye el **Manual Integral de la Aplicación Alon Car**, diseñado tanto para la capacitación de usuarios y supervisores como para la referencia técnica de desarrollo futuro. Explica el funcionamiento operativo de los módulos implementados, los flujos asistidos por Inteligencia Artificial y el listado de tareas pendientes.

---

## 📑 Índice de Contenidos
1. [Módulo M3: Carga de Horas & Tabulador Asistido por IA](#1-módulo-m3-carga-de-horas--tabulador-asistido-por-ia)
   - [1.1 Carga Manual de Cuadrilla](#11-carga-manual-de-cuadrilla)
   - [1.2 Tabulador Inteligente de Partes (WhatsApp / Audio)](#12-tabulador-inteligente-de-partes-whatsapp--audio)
   - [1.3 Puerta de Emergencia de Rubro (Préstamos Operativos)](#13-puerta-de-emergencia-de-rubro-préstamos-operativos)
   - [1.4 Modo Multi-Barco / Multi-OT por Fila](#14-modo-multi-barco--multi-ot-por-fila)
   - [1.5 Control de Jornada de 9 Horas del Astillero](#15-control-de-jornada-de-9-horas-del-astillero)
   - [1.6 Filtro y Bloqueo en Cascada](#16-filtro-y-bloqueo-en-cascada)
2. [Módulo M2: Padrón de Personal & Multi-Rubro](#2-módulo-m2-padrón-de-personal--multi-rubro)
3. [Módulo M1: Órdenes de Trabajo (OTs)](#3-módulo-m1-órdenes-de-trabajo-ots)
4. [Módulo Administrador: Tablero de Gobernanza IA & Prompts](#4-módulo-administrador-tablero-de-gobernanza-ia--prompts)
   - [4.1 Acceso y Seguridad](#41-acceso-y-seguridad)
   - [4.2 Configuración del Proveedor (Híbrido / Local)](#42-configuración-del-proveedor-híbrido--local)
   - [4.3 Editor de Prompts Versionados](#43-editor-de-prompts-versionados)
   - [4.4 Sandbox de Prueba](#44-sandbox-de-prueba)
   - [4.5 Bitácora de Auditoría (ai_processing_logs)](#45-bitácora-de-auditoría-ai_processing_logs)
5. [Arquitectura Técnica de Respaldo en 3 Niveles](#5-arquitectura-técnica-de-respaldo-en-3-niveles)
6. [📋 Lista de Tareas Pendientes y Hoja de Ruta](#6--lista-de-tareas-pendientes-y-hoja-de-ruta)

---

## 1. Módulo M3: Carga de Horas & Tabulador Asistido por IA

El módulo de Control y Carga de Horas (`/horas`) centraliza la imputación diaria de jornales de trabajo tanto para el personal propio del astillero como para contratistas y talleres externos.

### 1.1 Carga Manual de Cuadrilla
Permite seleccionar una cuadrilla y cargar operarios fila por fila:
1. **Paso 1 (Barco):** Se elige la embarcación activa en varadero/muelle. Los nombres aparecen limpios (sin prefijos redundantes como *"Astillero Alon Car"*).
2. **Paso 2 (Contratista / Grupo):** Filtra únicamente los grupos habilitados en trabajos *"En ejecución"* para dicho barco.
3. **Paso 3 (Orden de Trabajo):** Despliega exclusivamente las OTs en estado *"En ejecución"* donde esté autorizado el contratista elegido.
4. **Grilla:** Se agregan operarios con imputación de horas normales y extras (50% / 100%).

### 1.2 Tabulador Inteligente de Partes (WhatsApp / Audio)
Permite transformar reportes desestructurados enviados por capataces o jefes de obra en filas estructuradas de cuadrilla con **un solo clic**.

#### ¿Cómo redactar o enviar un parte?
El motor procesa lenguaje natural coloquial. Por ejemplo:
> *"Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación 5 hr en don Antonio bodega sacar porurietano y comentando"*

#### Reglas automáticas aplicadas:
1. **Multiplicación en Paralelo (RN-03):** Si el mensaje dice *"andres y diego 9hr"*, no divide las 9 horas entre dos; genera **9 hs para Andrés** y **9 hs para Diego**.
2. **Corrección Ortográfica de Jerga Naval (RN-09):** Corrige automáticamente términos típicos de taller:
   - `reguillas` ➔ *rejillas*
   - `cuvierta` ➔ *cubierta*
   - `trancalin` ➔ *trancalín*
   - `porurietano` ➔ *poliuretano*
   - `comentando` ➔ *cementando*
   - `vuoso` ➔ Identifica al barco *Siempre Don Vicente (Vuoso)*.
3. **Inferencia de Rubro Real (E3a):** Si un operario que tiene rubro titular "Calderería" realiza una tarea de "Soldadura parches", el motor le asigna el rubro real de la tarea (`Soldadura`).
4. **Prioridad a la División de Subtareas (E5/E6):** Si un operario realiza tareas en barcos u OTs distintas durante el día (ej. Franco Vuoso: 2h portones, 2h prueba, 5h bodega), el motor divide las tareas en filas separadas para preservar el costeo exacto de cada OT. Si el operador prefiere agruparlas, cuenta con el botón **"Consolidar Misma OT"**.
5. **Detección de Homónimos:** Si el mensaje menciona solo el nombre de pila y hay más de un operario con ese nombre (ej. *"Diego"* o *"Rodriguez"*), el sistema despliega un aviso ámbar con botones directos para elegir al operario correcto en 1 clic.

---

### 1.3 Puerta de Emergencia de Rubro (Préstamos Operativos)
En la operación naval real es habitual que un pintor sea asignado temporalmente a raschinar, o que alguien de raschinaje ayude en calderería. El sistema garantiza el orden sin trabar la operación:

- **Por Defecto (Automático):** Al seleccionar un operario, el sistema completa automáticamente su rubro titular del padrón (ej. *Calderería*).
- **Puerta de Emergencia (`🔓 Ajustar`):** Al tocar este botón en cualquier fila, el campo se desbloquea y permite elegir cualquier rubro oficial del catálogo.
- **Badge Visual de Préstamo:** Cuando el rubro asignado difiere del rubro titular, la fila exhibe una etiqueta distintiva:
  `🔄 Préstamo: Calderería ➔ Raschinear` junto a un enlace **"Reset"** para retornar al titular con 1 clic.

---

### 1.4 Modo Multi-Barco / Multi-OT por Fila
Cuando un parte diario incluye trabajos en múltiples barcos a la vez (ej. una parte en *Tritón*, otra en *Don Antonio* y otra en *Vuoso*):
- Se activa la opción **"Activar Multi-Barco por Fila"**.
- Cada fila de la cuadrilla muestra su propio selector independiente de **Barco** y de **OT Habilitada**.
- **Botón `+ Crear Barco/OT` en 1 Clic:** Si el parte menciona un barco nuevo o una tarea que aún no tiene OT en ejecución, la fila exhibe un botón directo que crea el barco (si no existe) y genera la Orden de Trabajo habilitada en estado *"En ejecución"*, vinculándola de inmediato a la grilla sin tener que salir de la pantalla.

---

### 1.5 Control de Jornada de 9 Horas del Astillero
Para el personal propio de Alon Car rige la regla obligatoria de **9 horas diarias** (o **8 horas** si la jornada corresponde a Feriado):
- Una barra superior de estado calcula en tiempo real la suma de horas de cada operario en el borrador:
  - `Toledo, Luciano: 9h ✅` (Jornada completa).
  - `Vuoso, Franco: 2h + 2h + 5h = 9h ✅` (Múltiples subtareas que completan la jornada).
  - `López, Ricardo: 6h ⚠️ (<9h)` (Alerta visual de horas faltantes).
  - `Gari, Andrés: 11h ⚡ (>9h)` (Cálculo automático de horas extras al 50% y 100%).

---

### 1.6 Filtro y Bloqueo en Cascada
Para evitar imputaciones erróneas de costos:
- Si una OT o trabajo está en estado *Pendiente de inicio, Detenido, Cancelado o Finalizado*, queda **bloqueada** y no aparece en los selectores.
- Al seleccionar el Barco, únicamente se listan los contratistas con trabajos en ejecución en ese barco.
- Al seleccionar el Contratista, únicamente se listan las OTs donde dicho contratista está explícitamente habilitado.

---

## 2. Módulo M2: Padrón de Personal & Multi-Rubro

Ubicado en `/personal`, gestiona la nómina del astillero, contratistas externos y talleres de terceros.

### Habilitación Multi-Rubro para Contratistas
Los talleres y contratistas externos pueden prestar servicios en diversas especialidades:
- En la ficha del operario/contratista se habilita la asignación de múltiples rubros (ej. `CALDERERIA, SOLDADURA, MECANICA`).
- El primer rubro seleccionado se designa con la medalla **`⭐ Principal`**.
- En la grilla de carga de horas, el contratista despliega únicamente sus rubros autorizados, manteniendo la opción de abrir la *Puerta de Emergencia* si se requiere un oficio excepcional.

---

---

## 3. Módulo M1: Barcos, Ficha Técnica Naval & Calendario de Estadías

Ubicado en `/barcos`:

### 3.1 Catálogo de Buques & Ficha 360°
- **Nombres Limpios:** Todos los buques se presentan sin prefijos de empresa (ej. `TRITON I` en lugar de `Astillero Alon Car Triton`).
- **Baja Lógica Inviolable:** No se eliminan buques físicos para preservar el historial de OTs y jornales contables. Al desactivar un barco pasa a estado `Inactivo`.
- **Ficha 360° Integral:**
  - **Ficha Técnica Naval (Jefes de Obra):** Eslora (m), Manga (m), Puntal (m), Superficie de Casco ($m^2$).
  - **Componentes Dinámicos (JSONB):** Tanques de combustible, tanques de agua, válvulas de casco (1" a 2½" y 3" a 6"), válvulas intermediarias y pocetes de achique. Si la cantidad es mayor a 0, se habilita el campo amplio de observaciones/distribución.
  - **Armador & Contactos (María José):** Razón social de la empresa, nombre del armador, teléfono directo, email principal y secundario.
  - **Historial de OTs:** Consulta directa de trabajos activos e históricos en `/ots`.

### 3.2 Calendario de Movimientos & Estadías (Reemplazo de Excel Legacy)
- **Locaciones Oficiales:**
  - `VARADERO ALON CAR` (Puesta en seco en anguilera).
  - `MUELLE ALON CAR` (Permanencia a flote con servicios).
  - `PUERTO 1RA ALDANA` a `PUERTO 7MA ALDANA` (Muelles y rada externa).
- **Cálculo de Días Corridos:**
  - Fecha de Comienzo ingresada manualmente.
  - Si la Fecha Fin está vacía (estadía en curso), el sistema aplica dinámicamente `=HOY()` para acumular días en vivo.
  - **Fórmula de Días:** `Fin - Comienzo + 1` días corridos inclusivos.
  - Al cambiar de locación o zarpar, se cierra la fecha de salida manual.
- **Electricidad:** Omitida deliberadamente en este submódulo operativo; su valorización monetaria se realiza en el Anexo de Factura del Módulo 5.

### 3.3 Matriz de Roles y Solicitud de Carga
- **Jorge Sentis (Administrador):** Da de alta el buque y tiene el botón **"📢 Solicitar Info"** para encomendar la carga de datos a María José (armador/contactos), a Jefes de Obra (medidas/ficha técnica) o a ambos.
- **María José (Comercial / Administración):** Administra empresas armadoras, datos de contacto y el Calendario de Movimientos.
- **Jefes de Obra (Técnico / Operaciones):** Verifican y completan la Ficha Técnica Naval a bordo.

---

## 4. Módulo: Órdenes de Trabajo (OTs)

Ubicado en `/ots`:
1. **Consecutivo Automático:** El número correlativo de OT es generado exclusivamente por el sistema y no es editable manualmente para preservar la integridad contable.
2. **Tipo de Facturación (Centro de Facturación):**
   - *Presupuesto General:* Trabajos cotizados dentro del contrato base de la obra.
   - *Adicional / Específico:* Trabajos surgidos durante la varada que se facturan por fuera del presupuesto general.
3. **Eliminación Segura (Baja Lógica):** No se permite borrar físicamente registros de OTs para no generar huecos en la numeración correlativa. Al presionar "Eliminar", el sistema cambia el estado a **`ESTADO DEL TRABAJO = Desestimado`** y estampa la leyenda *"Desestimada por eliminación"*.
4. **Alta Rápida de Jefe de Obra:** Al crear una OT, el desplegable de Jefe de Obra cuenta con un botón final **"+ Crear nuevo jefe de obra"** con rubro *"Técnico"* precargado, creando la relación de inmediato sin abandonar el formulario.
5. **Separación de OTs de un Contenedor:** Si una orden comenzó agrupada dentro de un trabajo y con el tiempo requiere individualidad de costeo, se edita su asignación de contenedor y centro de facturación manteniendo intactas las fechas de creación, inicio y fin.

---

## 5. Módulo Administrador: Tablero de Gobernanza IA & Prompts

Ubicado exclusivamente dentro de `/admin` en la pestaña **`🧠 Gobernanza IA & Prompts`**.

### 5.1 Acceso y Seguridad
- Esta pestaña está **oculta para los operadores normales** y solo es visible para usuarios con rol de Administrador.
- Permite la configuración integral del motor de inteligencia artificial sin necesidad de modificar código fuente ni reiniciar servidores.

### 5.2 Configuración del Proveedor
- **Modos de Operación:**
  - `Híbrido`: Intenta interpretar con OpenAI (`gpt-4o-mini`) y, si hay corte de red o falta de saldo, activa instantáneamente el parser local.
  - `Solo OpenAI`: Exige validación con el modelo LLM.
  - `Solo Local`: Utiliza el motor determinístico naval (costo \$0 permanente).
- **Parámetros:** Configuración de Modelo (`gpt-4o-mini`), Temperatura (`0.0` para máxima precisión determinística) y API Key.

### 5.3 Editor de Prompts Versionados
El sistema cuenta con 4 prompts maestros almacenados en la tabla `public.system_prompts`:
1. `router_clasificador_e3a`: Clasifica si el parte corresponde a personal propio, contratistas o maquinaria.
2. `prompt_astillero`: Reglas de jornada de 9h, distribución de extras (50%/100%) y resolución de oficios.
3. `prompt_contratistas`: Reglas de acumulación de horas de terceros sin límite de 9h y multi-rubro.
4. `diccionario_jerga_naval`: Diccionario vivo en formato JSON con alias de barcos, corrección ortográfica de taller y apodos de operarios.

> Al editar y presionar **"Guardar nueva versión"**, el sistema incrementa el número correlativo (ej. de `v2.4` a `v2.5`), registra el usuario administrador que realizó el cambio y lo sincroniza de inmediato en Supabase para toda la empresa.

### 5.4 Sandbox de Prueba
Permite pegar cualquier parte de trabajo y ejecutar el análisis en vivo contra los prompts actuales para validar cómo se estructuran las filas antes de que los operarios lo usen en producción. **No guarda horas en la base de datos.**

### 5.5 Bitácora de Auditoría (`ai_processing_logs`)
Cada vez que se procesa un mensaje en la aplicación, se guarda una entrada inmutable con:
- Fecha y hora del procesamiento.
- Usuario emisor.
- Motor utilizado (`supabase_edge_openai`, `openai_gpt4o_mini` o `local_deterministic`).
- Versión del prompt utilizada.
- Conteo de filas automáticas vs. filas que requirieron revisión.
- Consumo de tokens de entrada y salida.

---

## 6. Arquitectura Técnica de Respaldo en 3 Niveles

El procesamiento de partes opera bajo una arquitectura de alta disponibilidad de triple capa:

```
[ Mensaje de WhatsApp / Audio ]
             │
             ▼
┌──────────────────────────────────────────────┐
│  NIVEL 1: Supabase Edge Function (Servidor)  │ ──► La API key nunca llega al navegador.
│  Endpoint: /functions/v1/parse-crew-message  │
└──────────────────────────────────────────────┘
             │ (Si la función no está desplegada o falla)
             ▼
┌──────────────────────────────────────────────┐
│  NIVEL 2: Llamada Directa Cliente (OpenAI)   │ ──► Utiliza la clave cargada en .env.local
│  Modelo: gpt-4o-mini (Costo: centavos USD)   │
└──────────────────────────────────────────────┘
             │ (Si no hay internet, falla OpenAI o no hay saldo)
             ▼
┌──────────────────────────────────────────────┐
│  NIVEL 3: Parser Naval Determinístico Local   │ ──► Algoritmo nativo JavaScript en el navegador.
│  aiLaborEngine.js (Costo: $0, 100% Offline)   │     Aplica RN-03, RN-05, RN-09 y Diccionario.
└──────────────────────────────────────────────┘
             │
             ▼
[ Grilla de Cuadrilla Cargada ]
```

---

## 6. 📋 Lista de Tareas Pendientes y Hoja de Ruta

### 🔴 Tarea 1: Rotar API Key y fijar Límite de Gasto Mensual
- **Responsable:** Usuario Administrador (Acción Personal).
- **Tiempo estimado:** 2 minutos.
- **Motivo de seguridad:** La clave provista inicialmente durante las pruebas quedó registrada en el historial de la conversación.
- **Pasos a seguir:**
  1. Ingresar a [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
  2. Revocar / eliminar la clave antigua (`sk-proj-Qn0h...`).
  3. Generar una nueva clave secreta con nombre `AlonCar-Produccion`.
  4. Guardar la nueva clave en [`app/.env.local`](file:///C:/Users/Vanoli/.gemini/antigravity/scratch/App_AlonCar/app/.env.local) o en el panel de **Gobernanza IA** en `/admin`.
  5. En [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits), fijar un **Monthly Budget** de \$5 o \$10 USD para tener control financiero total sin riesgo de cargos inesperados.

### 🟡 Tarea 2: Despliegue de la Edge Function en Supabase (Opcional para Producción)
- **Estado:** Código generado en [`supabase/functions/parse-crew-message/index.ts`](file:///C:/Users/Vanoli/.gemini/antigravity/scratch/App_AlonCar/supabase/functions/parse-crew-message/index.ts).
- **Instrucción de despliegue:**
  ```powershell
  npx supabase secrets set OPENAI_API_KEY="tu-nueva-api-key"
  npx supabase functions deploy parse-crew-message --no-verify-jwt
  ```
- Al desplegarla, el sistema pasará a utilizar de forma transparente el Nivel 1 (Servidor).

### 🟢 Tarea 3: Replicar Habilitación en Cascada en Materiales (M4) y Terceros
- Aplicar exactamente la misma lógica desarrollada en Horas:
  - Al elegir el Barco ➔ se filtran los contratistas y proveedores autorizados.
  - Al elegir el Contratista/Rubro ➔ se filtran únicamente las OTs en estado *"En ejecución"*.
